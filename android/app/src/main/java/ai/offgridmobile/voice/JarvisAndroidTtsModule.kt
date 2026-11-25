package ai.offgridmobile.voice

import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale
import java.util.UUID

/**
 * Open-source native Android TextToSpeech bridge for Jarvis Ai.
 * Uses Android's on-device TTS engine (ru-RU by default) without cloud dependencies.
 */
class JarvisAndroidTtsModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val lock = Any()
  private var tts: TextToSpeech? = null
  private var ready = false
  private var initFailed = false
  private var initializing = false
  private val waiters = mutableListOf<(Boolean) -> Unit>()

  override fun getName(): String = "JarvisAndroidTtsModule"

  private fun emitState(state: String, utteranceId: String? = null, error: String? = null) {
    if (!reactContext.hasActiveReactInstance()) return
    val map = Arguments.createMap().apply {
      putString("state", state)
      if (utteranceId != null) putString("utteranceId", utteranceId)
      if (error != null) putString("error", error)
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("JarvisTtsState", map)
  }

  private fun ensureInitialized(callback: (Boolean) -> Unit) {
    val existingReady: Boolean
    val existingFailed: Boolean
    synchronized(lock) {
      if (ready && tts != null) {
        existingReady = true
        existingFailed = false
      } else if (initFailed) {
        existingReady = false
        existingFailed = true
      } else {
        waiters.add(callback)
        if (initializing) return
        initializing = true
        existingReady = false
        existingFailed = false
      }
    }
    if (existingReady) {
      callback(true)
      return
    }
    if (existingFailed) {
      callback(false)
      return
    }

    try {
      val handler = android.os.Handler(android.os.Looper.getMainLooper())
      lateinit var created: TextToSpeech
      created = TextToSpeech(reactContext.applicationContext) { status ->
        handler.post {
          val ok = status == TextToSpeech.SUCCESS
          val pending: List<(Boolean) -> Unit>
          synchronized(lock) {
            initializing = false
            if (ok) {
              tts = created
              ready = true
              initFailed = false
              created.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                  emitState("speaking", utteranceId)
                }

                override fun onDone(utteranceId: String?) {
                  emitState("done", utteranceId)
                }

                @Deprecated("Deprecated in Android API")
                override fun onError(utteranceId: String?) {
                  emitState("error", utteranceId, "TTS playback error")
                }

                override fun onError(utteranceId: String?, errorCode: Int) {
                  emitState("error", utteranceId, "TTS error code $errorCode")
                }
              })
            } else {
              tts = null
              ready = false
              initFailed = true
            }
            pending = waiters.toList()
            waiters.clear()
          }
          pending.forEach { it(ok) }
        }
      }
    } catch (_: Throwable) {
      val pending: List<(Boolean) -> Unit>
      synchronized(lock) {
        initializing = false
        ready = false
        initFailed = true
        pending = waiters.toList()
        waiters.clear()
      }
      pending.forEach { it(false) }
    }
  }

  @ReactMethod
  fun isAvailable(promise: Promise) {
    ensureInitialized { ok -> promise.resolve(ok) }
  }

  @ReactMethod
  fun speak(text: String, languageTag: String?, rate: Double, voiceId: String?, promise: Promise) {
    val clean = text.trim()
    if (clean.isEmpty()) {
      promise.resolve(false)
      return
    }
    ensureInitialized { ok ->
      val engine = synchronized(lock) { tts }
      if (!ok || engine == null) {
        promise.reject("TTS_UNAVAILABLE", "Android TextToSpeech is unavailable on this device.")
        return@ensureInitialized
      }
      try {
        val requestedVoice = voiceId?.trim()?.takeIf { it.isNotEmpty() }?.let { targetId ->
          try {
            engine.voices?.firstOrNull { it.name == targetId }
          } catch (_: Throwable) {
            null
          }
        }
        if (requestedVoice != null) {
          engine.voice = requestedVoice
        } else {
          val tag = languageTag?.takeIf { it.isNotBlank() } ?: "ru-RU"
          val requestedLocale = Locale.forLanguageTag(tag)
          val langResult = engine.setLanguage(requestedLocale)
          if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
            val ruFallback = engine.setLanguage(Locale("ru", "RU"))
            if (ruFallback == TextToSpeech.LANG_MISSING_DATA || ruFallback == TextToSpeech.LANG_NOT_SUPPORTED) {
              engine.setLanguage(Locale.getDefault())
            }
          }
        }
        val speechRate = rate.toFloat().coerceIn(0.5f, 2.0f)
        engine.setSpeechRate(speechRate)
        val utteranceId = UUID.randomUUID().toString()
        val params = Bundle()
        val result = engine.speak(clean.take(3800), TextToSpeech.QUEUE_FLUSH, params, utteranceId)
        promise.resolve(result == TextToSpeech.SUCCESS)
      } catch (error: Throwable) {
        promise.reject("TTS_SPEAK_FAILED", error.message ?: "Could not start TTS.", error)
      }
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    val engine = synchronized(lock) { tts }
    try {
      engine?.stop()
      emitState("done", null)
      promise.resolve(true)
    } catch (error: Throwable) {
      promise.reject("TTS_STOP_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun isSpeaking(promise: Promise) {
    val engine = synchronized(lock) { tts }
    promise.resolve(try { engine?.isSpeaking == true } catch (_: Throwable) { false })
  }

  @ReactMethod
  fun getVoices(promise: Promise) {
    ensureInitialized { ok ->
      val engine = synchronized(lock) { tts }
      val result = Arguments.createArray()
      if (ok && engine != null) {
        try {
          val voices = engine.voices?.sortedWith(
            compareByDescending<android.speech.tts.Voice> {
              it.locale.language.equals("ru", ignoreCase = true)
            }.thenBy { it.name }
          ).orEmpty()
          for (v in voices.take(20)) {
            val row = Arguments.createMap().apply {
              putString("id", v.name)
              putString("name", v.name)
              putString("locale", v.locale.toLanguageTag())
              putBoolean("networkRequired", v.isNetworkConnectionRequired)
            }
            result.pushMap(row)
          }
        } catch (_: Throwable) {
          // Some ROMs throw on engine.voices; return empty list cleanly.
        }
      }
      promise.resolve(result)
    }
  }

  @ReactMethod
  fun addListener(_eventName: String) {}

  @ReactMethod
  fun removeListeners(_count: Int) {}

  override fun invalidate() {
    val engine: TextToSpeech?
    synchronized(lock) {
      engine = tts
      tts = null
      ready = false
      waiters.clear()
    }
    try {
      engine?.stop()
      engine?.shutdown()
    } catch (_: Throwable) {
    }
    super.invalidate()
  }
}
