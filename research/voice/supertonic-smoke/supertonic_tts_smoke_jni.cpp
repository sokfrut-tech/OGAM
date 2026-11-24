/**
 * Isolated Supertonic-3 TTS-only Android arm64 JNI smoke adapter (research branch only).
 *
 * Proves:
 * 1. Complete link closure of `speech_core::LiteRTSupertonicTts` + `TTSInterface` + Ooura de-esser
 *    against `libLiteRt.so` 2.3.2 (`ANDROID` / `arm64-v8a` / API 24) with zero ONNX Runtime / curl.
 * 2. Synchronous Float32 PCM copy into JNI `jfloatArray` inside the calling callback (zero raw
 *    native pointer escape).
 * 3. Pre-entry cancellation safety via `SupertonicCancelGate` + patched monotonic `cancel_epoch_`.
 */

#include <android/log.h>
#include <jni.h>

#include <atomic>
#include <cstdint>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>

#include "speech_core/models/litert_supertonic_tts.h"
#include "supertonic_cancel_gate.h"

namespace {

constexpr const char* kTag = "OgSupertonicSmoke";

struct SmokeHandle {
  std::unique_ptr<speech_core::LiteRTSupertonicTts> tts;
  ogam::research::SupertonicCancelGate gate;
  std::mutex synth_mutex;
};

jstring throw_illegal_state(JNIEnv* env, const char* msg) {
  jclass cls = env->FindClass("java/lang/IllegalStateException");
  if (cls) env->ThrowNew(cls, msg);
  return nullptr;
}

std::string to_std_string(JNIEnv* env, jstring value) {
  if (!value) return {};
  const char* chars = env->GetStringUTFChars(value, nullptr);
  if (!chars) return {};
  std::string out(chars);
  env->ReleaseStringUTFChars(value, chars);
  return out;
}

}  // namespace

extern "C" {

JNIEXPORT jlong JNICALL
Java_ai_offgridmobile_voice_research_SupertonicSmokeBridge_nativeCreate(
    JNIEnv* env,
    jclass /*clazz*/,
    jstring duration_path,
    jstring text_encoder_path,
    jstring vector_estimator_path,
    jstring vocoder_path,
    jstring tokenizer_dir,
    jstring voice_styles_dir,
    jboolean hw_accel) {
  try {
    auto handle = std::make_shared<SmokeHandle>();
    handle->tts = std::make_unique<speech_core::LiteRTSupertonicTts>(
        to_std_string(env, duration_path),
        to_std_string(env, text_encoder_path),
        to_std_string(env, vector_estimator_path),
        to_std_string(env, vocoder_path),
        to_std_string(env, tokenizer_dir),
        to_std_string(env, voice_styles_dir),
        hw_accel == JNI_TRUE);
    auto* holder = new std::shared_ptr<SmokeHandle>(std::move(handle));
    return reinterpret_cast<jlong>(holder);
  } catch (const std::exception& e) {
    __android_log_print(ANDROID_LOG_ERROR, kTag, "nativeCreate failed: %s", e.what());
    throw_illegal_state(env, e.what());
    return 0;
  }
}

JNIEXPORT void JNICALL
Java_ai_offgridmobile_voice_research_SupertonicSmokeBridge_nativeDestroy(
    JNIEnv* /*env*/,
    jclass /*clazz*/,
    jlong handle_ptr) {
  if (!handle_ptr) return;
  auto* holder = reinterpret_cast<std::shared_ptr<SmokeHandle>*>(handle_ptr);
  if (*holder) {
    (*holder)->gate.cancel_all();
    (*holder)->tts->cancel();
  }
  delete holder;
}

JNIEXPORT jlong JNICALL
Java_ai_offgridmobile_voice_research_SupertonicSmokeBridge_nativeBeginRequest(
    JNIEnv* /*env*/,
    jclass /*clazz*/,
    jlong handle_ptr) {
  if (!handle_ptr) return 0;
  auto* holder = reinterpret_cast<std::shared_ptr<SmokeHandle>*>(handle_ptr);
  return static_cast<jlong>((*holder)->gate.begin_request());
}

JNIEXPORT void JNICALL
Java_ai_offgridmobile_voice_research_SupertonicSmokeBridge_nativeCancelGeneration(
    JNIEnv* /*env*/,
    jclass /*clazz*/,
    jlong handle_ptr,
    jlong generation) {
  if (!handle_ptr) return;
  auto* holder = reinterpret_cast<std::shared_ptr<SmokeHandle>*>(handle_ptr);
  (*holder)->gate.cancel(static_cast<uint64_t>(generation));
  (*holder)->tts->cancel();
}

JNIEXPORT void JNICALL
Java_ai_offgridmobile_voice_research_SupertonicSmokeBridge_nativeSynthesize(
    JNIEnv* env,
    jclass /*clazz*/,
    jlong handle_ptr,
    jlong generation,
    jstring text,
    jstring language,
    jobject callback) {
  if (!handle_ptr || !callback) return;
  auto handle = *reinterpret_cast<std::shared_ptr<SmokeHandle>*>(handle_ptr);
  const uint64_t gen = static_cast<uint64_t>(generation);
  if (handle->gate.is_cancelled(gen)) return;

  // Capture monotonic engine epoch BEFORE waiting on synth_mutex so any cancel() invoked while
  // queued or prior to entry aborts immediately via `synthesize_with_epoch`.
  const uint64_t epoch = handle->tts->begin_synthesis_epoch();
  std::lock_guard<std::mutex> lock(handle->synth_mutex);
  if (handle->gate.is_cancelled(gen)) return;

  jclass cb_class = env->GetObjectClass(callback);
  jmethodID on_chunk_mid = cb_class ? env->GetMethodID(cb_class, "onPcmChunk", "([FZ)V") : nullptr;
  if (!on_chunk_mid) {
    throw_illegal_state(env, "Callback must expose void onPcmChunk(float[], boolean)");
    return;
  }

  const std::string text_utf8 = to_std_string(env, text);
  const std::string lang_utf8 = to_std_string(env, language);

  try {
    handle->tts->synthesize_with_epoch(
        epoch,
        text_utf8,
        lang_utf8,
        [&](const float* samples, size_t length, bool is_final) {
          if (handle->gate.is_cancelled(gen) || !samples || length == 0) {
            return;
          }
          const jsize n = static_cast<jsize>(length);
          jfloatArray arr = env->NewFloatArray(n);
          if (!arr) return;
          // Synchronous copy before returning: raw `samples` pointer never escapes callback.
          env->SetFloatArrayRegion(arr, 0, n, samples);
          env->CallVoidMethod(callback, on_chunk_mid, arr, is_final ? JNI_TRUE : JNI_FALSE);
          env->DeleteLocalRef(arr);
        });
  } catch (const std::exception& e) {
    __android_log_print(ANDROID_LOG_ERROR, kTag, "nativeSynthesize failed: %s", e.what());
    throw_illegal_state(env, e.what());
  }
  handle->gate.finish(gen);
}

}  // extern "C"
