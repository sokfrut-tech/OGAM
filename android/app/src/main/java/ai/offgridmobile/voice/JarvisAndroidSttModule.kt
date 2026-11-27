package ai.offgridmobile.voice

import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognitionService
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
 * out of the box. Prefers Google Speech Services over OEM recognizers (such as Breeno/ColorOS)
 * so Russian dictation is routed to a true Russian ASR backend instead of EN/ZH fallbacks.
 */
class JarvisAndroidSttModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private var speechRecognizer: SpeechRecognizer? = null
  private var activeLanguage: String = "ru-RU"
  private var activeServicePackage: String = "default"
  private var retriedOnline: Boolean = false
  private var activeSession: Boolean = false

  override fun getName(): String = "JarvisAndroidSttModule"

  companion object {
    private val PREFERRED_GOOGLE_PACKAGES = listOf(
      "com.google.android.tts",
      "com.google.android.as",
      "com.google.android.googlequicksearchbox",
    )
    private val CYRILLIC_REGEX = Regex("[А-Яа-яЁё]")
  }

  private fun queryRecognitionServices() = runCatching {
    val pm = reactContext.packageManager
    val query = Intent(RecognitionService.SERVICE_INTERFACE)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      pm.queryIntentServices(query, PackageManager.ResolveInfoFlags.of(0))
    } else {
      @Suppress("DEPRECATION")
      pm.queryIntentServices(query, 0)
    }
  }.getOrDefault(emptyList())

  private fun resolvePreferredRecognitionComponent(): Pair<ComponentName?, String> {
    val services = queryRecognitionServices()
    for (pkg in PREFERRED_GOOGLE_PACKAGES) {
      val match = services.firstOrNull { it.serviceInfo?.packageName == pkg }
      val info = match?.serviceInfo
      if (info != null) {
        return ComponentName(info.packageName, info.name) to info.packageName
      }
    }
    val fallbackPkg = services.firstOrNull()?.serviceInfo?.packageName ?: "default"
    return null to fallbackPkg
  }

  private fun pickBestMatch(matches: List<String>?, languageTag: String): String {
    if (matches.isNullOrEmpty()) return ""
    if (languageTag.startsWith("ru", ignoreCase = true)) {
      val cyrillic = matches.firstOrNull { !it.isNullOrBlank() && CYRILLIC_REGEX.containsMatchIn(it) }
      if (!cyrillic.isNullOrBlank()) return cyrillic.trim()
    }
    return matches.firstOrNull { !it.isNullOrBlank() }?.trim().orEmpty()
  }

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

    val (preferredComponent, resolvedPkg) = resolvePreferredRecognitionComponent()
    val recognizer = if (preferredComponent != null) {
      SpeechRecognizer.createSpeechRecognizer(reactContext, preferredComponent)
    } else {
      SpeechRecognizer.createSpeechRecognizer(reactContext)
    }
    speechRecognizer = recognizer
    activeSession = true
    activeLanguage = languageTag
    activeServicePackage = resolvedPkg

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
        val best = pickBestMatch(matches, activeLanguage)
        emit("JarvisSttResult") { it.putString("text", best) }
        emit("JarvisSttState") { it.putString("state", "ended") }
      }

      override fun onPartialResults(partialResults: Bundle?) {
        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val partial = pickBestMatch(matches, activeLanguage)
        if (partial.isNotEmpty()) {
          emit("JarvisSttPartial") { it.putString("text", partial) }
        }
      }

      override fun onEvent(eventType: Int, params: Bundle?) {}
    })

    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, reactContext.packageName)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, languageTag)
      putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, true)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
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
  fun getEngineInfo(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      val available = runCatching { SpeechRecognizer.isRecognitionAvailable(reactContext) }.getOrDefault(false)
      val (_, pkg) = resolvePreferredRecognitionComponent()
      val isGoogle = PREFERRED_GOOGLE_PACKAGES.contains(pkg)
      promise.resolve(
        Arguments.createMap().apply {
          putBoolean("available", available)
          putString("servicePackage", pkg)
          putBoolean("isGoogleService", isGoogle)
        },
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
