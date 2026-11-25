package ai.offgridmobile.voice

import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Built-in Android SpeechRecognizer bridge for immediate Russian/multilingual voice input
 * out of the box, with automatic online fallback when an offline language pack is absent.
 */
class JarvisAndroidSttModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private var speechRecognizer: SpeechRecognizer? = null
  private var activeLanguage: String = "ru-RU"
  private var retriedOnline: Boolean = false
  private var activeSession: Boolean = false

  override fun getName(): String = "JarvisAndroidSttModule"

  private fun emit(eventName: String, build: (com.facebook.react.bridge.WritableMap) -> Unit) {
    if (!reactContext.hasActiveReactInstance()) return
    val payload = Arguments.createMap().apply(build)
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, payload)
  }

  private fun destroyRecognizerOnUiThread() {
    activeSession = false
    val existing = speechRecognizer
    speechRecognizer = null
    if (existing != null) {
      runCatching { existing.cancel() }
      runCatching { existing.destroy() }
    }
  }

  private fun startInternalOnUiThread(languageTag: String, preferOffline: Boolean) {
    destroyRecognizerOnUiThread()
    if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
      emit("JarvisSttError") {
        it.putInt("code", -1)
        it.putString("message", "Системный голосовой ввод недоступен на устройстве.")
      }
      emit("JarvisSttState") { it.putString("state", "ended") }
      return
    }

    val recognizer = SpeechRecognizer.createSpeechRecognizer(reactContext)
    speechRecognizer = recognizer
    activeSession = true
    activeLanguage = languageTag

    recognizer.setRecognitionListener(object : RecognitionListener {
      override fun onReadyForSpeech(params: Bundle?) {
        emit("JarvisSttState") { it.putString("state", "ready") }
      }

      override fun onBeginningOfSpeech() {
        emit("JarvisSttState") { it.putString("state", "listening") }
      }

      override fun onRmsChanged(rmsdB: Float) {}

      override fun onBufferReceived(buffer: ByteArray?) {}

      override fun onEndOfSpeech() {
        emit("JarvisSttState") { it.putString("state", "processing") }
      }

      override fun onError(error: Int) {
        val canRetryOnline =
          preferOffline &&
            !retriedOnline &&
            activeSession &&
            (error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED ||
              error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE ||
              error == SpeechRecognizer.ERROR_NETWORK ||
              error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT)
        if (canRetryOnline) {
          retriedOnline = true
          startInternalOnUiThread(activeLanguage, false)
          return
        }
        activeSession = false
        emit("JarvisSttError") {
          it.putInt("code", error)
          it.putString("message", mapErrorMessage(error))
        }
        emit("JarvisSttState") { it.putString("state", "ended") }
      }

      override fun onResults(results: Bundle?) {
        activeSession = false
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val best = matches?.firstOrNull()?.trim().orEmpty()
        emit("JarvisSttResult") { it.putString("text", best) }
        emit("JarvisSttState") { it.putString("state", "ended") }
      }

      override fun onPartialResults(partialResults: Bundle?) {
        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val partial = matches?.firstOrNull()?.trim().orEmpty()
        if (partial.isNotEmpty()) {
          emit("JarvisSttPartial") { it.putString("text", partial) }
        }
      }

      override fun onEvent(eventType: Int, params: Bundle?) {}
    })

    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
      if (preferOffline) {
        putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
      }
    }
    recognizer.startListening(intent)
  }

  private fun mapErrorMessage(code: Int): String = when (code) {
    SpeechRecognizer.ERROR_NO_MATCH -> "Речь не распознана."
    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Ничего не услышано."
    SpeechRecognizer.ERROR_AUDIO -> "Ошибка записи с микрофона."
    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Нет разрешения на микрофон."
    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT ->
      "Нет сети для распознавания или не установлен офлайн-пакет речи."
    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Распознавание речи занято другим процессом."
    SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED, SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE ->
      "Языковой пакет распознавания недоступен на устройстве."
    else -> "Ошибка голосового ввода (код $code)."
  }

  @ReactMethod
  fun isAvailable(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      promise.resolve(
        runCatching { SpeechRecognizer.isRecognitionAvailable(reactContext) }.getOrDefault(false),
      )
    }
  }

  @ReactMethod
  fun startListening(languageTag: String?, preferOffline: Boolean, promise: Promise) {
    val cleanTag = languageTag?.trim()?.takeIf { it.isNotEmpty() } ?: "ru-RU"
    UiThreadUtil.runOnUiThread {
      try {
        retriedOnline = false
        startInternalOnUiThread(cleanTag, preferOffline)
        promise.resolve(true)
      } catch (error: Throwable) {
        activeSession = false
        promise.reject("STT_START_FAILED", error.message ?: "Failed to start STT.", error)
      }
    }
  }

  @ReactMethod
  fun stopListening(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      runCatching { speechRecognizer?.stopListening() }
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun cancel(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      destroyRecognizerOnUiThread()
      emit("JarvisSttState") { it.putString("state", "ended") }
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun addListener(_eventName: String) {}

  @ReactMethod
  fun removeListeners(_count: Int) {}

  override fun invalidate() {
    UiThreadUtil.runOnUiThread { destroyRecognizerOnUiThread() }
    super.invalidate()
  }
}
