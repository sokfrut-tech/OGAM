package ai.offgridmobile.voice

import java.io.File

/**
 * Model-neutral boundary for local Jarvis speech synthesis.
 *
 * The backend owns only model inference. It must not create an AudioTrack,
 * acquire AudioFocus, capture the microphone, or start a conversation turn.
 * Playback and generation-token ordering remain owned by JarvisPcmStreamPlayer.
 *
 * Implementations are blocking and must be invoked from a worker thread.
 * A true callback return of false means "stop producing audio now"; the
 * implementation must map that to the native engine's cancellation contract
 * when the engine actually supports it.
 */
internal interface JarvisTtsBackend : AutoCloseable {
  val id: String
  val capabilities: JarvisTtsCapabilities

  /** Load one verified model package from app-private storage. */
  fun load(modelDirectory: File)

  /**
   * Synthesize one request. Emit mono Float32 PCM chunks in order.
   *
   * Return false from [onPcmChunk] when the playback generation is stale or
   * the user has barged in. Backends that cannot stop native inference must
   * still stop forwarding chunks and report cancellation, but must not claim
   * that native compute was cancelled.
   */
  fun synthesize(
    request: JarvisTtsRequest,
    onPcmChunk: (samples: FloatArray, sampleRateHz: Int) -> Boolean,
  ): JarvisTtsResult

  /** Best-effort cancellation for the active request ID. */
  fun cancel(requestId: Long)

  /** Release all native contexts and model mappings. Safe to call repeatedly. */
  fun unload()

  override fun close() = unload()
}

internal enum class JarvisTtsOutputMode {
  /** One complete waveform is returned as one PCM callback. */
  BATCH,

  /** The caller submits sentence-sized requests and receives one chunk per sentence. */
  SENTENCE_CHUNKED,

  /** The native model emits PCM chunks before the full request is complete. */
  MODEL_STREAMING,
}

internal data class JarvisTtsCapabilities(
  val outputMode: JarvisTtsOutputMode,
  val supportsNativeCancellation: Boolean,
  val supportsVoiceCloning: Boolean = false,
  val supportsInstructionControl: Boolean = false,
  val supportsLanguageHint: Boolean = false,
  val supportedLanguageTags: Set<String> = emptySet(),
) {
  init {
    require(supportedLanguageTags.none { it.isBlank() }) {
      "Language tags must not be blank"
    }
  }
}

internal data class JarvisTtsRequest(
  val requestId: Long,
  val text: String,
  val languageTag: String = "ru-RU",
  val voiceId: String? = null,
  val speed: Float = 1.0f,
  val instruction: String? = null,
) {
  init {
    require(requestId > 0L) { "requestId must be positive" }
    require(text.isNotBlank()) { "TTS text must not be blank" }
    require(languageTag.isNotBlank()) { "languageTag must not be blank" }
    require(speed.isFinite() && speed in 0.5f..2.0f) {
      "speed must be finite and between 0.5x and 2.0x"
    }
  }
}

internal data class JarvisTtsResult(
  val requestId: Long,
  val sampleRateHz: Int,
  val emittedChunks: Int,
  val audioSamples: Long,
  val cancelled: Boolean,
  val errorMessage: String? = null,
) {
  init {
    require(requestId > 0L)
    require(sampleRateHz == 0 || sampleRateHz in 8_000..96_000)
    require(emittedChunks >= 0)
    require(audioSamples >= 0L)
  }

  val audioDurationMs: Long
    get() = if (sampleRateHz <= 0) 0L else audioSamples * 1_000L / sampleRateHz
}
