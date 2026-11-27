package ai.offgridmobile.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import java.util.concurrent.locks.LockSupport

/**
 * Small engine-neutral PCM stream player for Jarvis.
 *
 * A model backend (Sherpa, local-tts, etc.) may feed Float32 mono chunks into
 * [write]. The player owns AudioTrack/AudioFocus, ordering, cancellation and
 * native-resource release; it does not own microphone capture, text turns or a
 * TTS model. All long-running writes/finish calls must run off the UI thread.
 */
internal class JarvisPcmStreamPlayer(
  private val trackFactory: JarvisPcmTrackFactory,
  private val audioFocus: JarvisAudioFocusController,
) : AutoCloseable {

  private val lock = Any()
  private var generation = 0L
  private var starting = false
  private var active = false
  private var track: JarvisPcmTrack? = null

  val isActive: Boolean
    get() = synchronized(lock) { active || starting }

  /**
   * Begin a new mono Float32 stream. A monotonically increasing generation is
   * returned so chunks from an older answer can never enter a newer playback.
   * Returns null when the player is busy, the sample rate is invalid, or audio
   * focus/AudioTrack creation fails.
   */
  fun begin(sampleRate: Int): Long? {
    if (sampleRate !in MIN_SAMPLE_RATE..MAX_SAMPLE_RATE) return null

    val token = synchronized(lock) {
      if (active || starting) return null
      generation += 1
      starting = true
      generation
    }

    val focusGranted = try {
      audioFocus.request(
        onLost = { cancel(token) },
        onDuck = { setVolume(token, DUCKED_VOLUME) },
        onGain = { setVolume(token, NORMAL_VOLUME) },
      )
    } catch (_: Exception) {
      false
    }

    if (!focusGranted) {
      abandonFailedStart(token)
      return null
    }

    val candidate = try {
      trackFactory.create(sampleRate)
    } catch (_: Exception) {
      null
    }

    if (candidate == null) {
      abandonFailedStart(token)
      return null
    }

    val accepted = synchronized(lock) {
      if (generation != token || !starting) {
        false
      } else {
        track = candidate
        starting = false
        active = true
        true
      }
    }

    if (!accepted) {
      safeRelease(candidate, immediate = true)
      // Abandon only if this generation still owns the failed start. If cancel()
      // already ran and a newer reply acquired focus, never release that newer focus.
      abandonFailedStart(token)
      return null
    }

    // Publish the active generation before play(): an immediate focus-loss callback
    // can now invalidate and release this track without a late start resurrecting it.
    try {
      candidate.play()
    } catch (_: Exception) {
      cancel(token)
      return null
    }
    return if (isCurrent(token)) token else null
  }

  /**
   * Write the next Float32 mono PCM chunk in order.
   *
   * AudioTrack's non-blocking write is retried when its buffer is full, while
   * checking [generationToken] between attempts. [cancel] invalidates the token
   * immediately, so a stale synthesis callback cannot resume playback later.
   */
  fun write(generationToken: Long, samples: FloatArray, offset: Int = 0, length: Int = samples.size - offset): Boolean {
    require(offset >= 0 && length >= 0 && offset <= samples.size - length) {
      "Invalid PCM sample range"
    }
    if (length == 0) return isCurrent(generationToken)

    val target = synchronized(lock) {
      if (!active || generation != generationToken) null else track
    } ?: return false

    var cursor = offset
    val end = offset + length
    while (cursor < end) {
      if (!isCurrent(generationToken)) return false
      val written = try {
        target.write(samples, cursor, end - cursor)
      } catch (_: Exception) {
        cancel(generationToken)
        return false
      }

      when {
        written > 0 -> cursor += written
        written == 0 -> LockSupport.parkNanos(5_000_000L)
        else -> {
          cancel(generationToken)
          return false
        }
      }
    }
    return isCurrent(generationToken)
  }

  /**
   * Complete the current stream and drain queued output. Call from the synthesis
   * worker after the backend has supplied its final chunk.
   */
  fun finish(generationToken: Long) {
    val target = synchronized(lock) {
      if (generation != generationToken || !active) return
      active = false
      starting = false
      track.also { track = null }
    }
    if (target != null) safeRelease(target, immediate = false)
    audioFocus.abandon()
  }

  /**
   * Immediately stop output and invalidate the active generation. Safe to call
   * from a VAD/barge-in callback or when a new assistant turn replaces the old.
   */
  fun cancel(generationToken: Long? = null) {
    val target = synchronized(lock) {
      if (generationToken != null && generation != generationToken) return
      if (!active && !starting) return
      generation += 1
      starting = false
      active = false
      track.also { track = null }
    }
    if (target != null) safeRelease(target, immediate = true)
    audioFocus.abandon()
  }

  override fun close() {
    cancel()
  }

  private fun isCurrent(token: Long): Boolean =
    synchronized(lock) { active && generation == token }

  private fun setVolume(token: Long, volume: Float) {
    val target = synchronized(lock) {
      if (active && generation == token) track else null
    } ?: return
    try {
      target.setVolume(volume)
    } catch (_: Exception) {
      cancel(token)
    }
  }

  private fun abandonFailedStart(token: Long) {
    val shouldAbandon = synchronized(lock) {
      if (generation != token) {
        false
      } else {
        starting = false
        active = false
        track = null
        generation += 1
        true
      }
    }
    if (shouldAbandon) audioFocus.abandon()
  }

  private fun safeRelease(target: JarvisPcmTrack, immediate: Boolean) {
    try {
      if (immediate) {
        target.pause()
        target.flush()
      }
    } catch (_: Exception) {
      // Continue with stop/release; cancellation must be best-effort and idempotent.
    }
    try {
      target.stop()
    } catch (_: Exception) {
      // AudioTrack may already be stopped after an asynchronous route/focus change.
    }
    try {
      target.release()
    } catch (_: Exception) {
      // A release failure must not wedge the next generation.
    }
  }

  companion object {
    const val MIN_SAMPLE_RATE = 8_000
    const val MAX_SAMPLE_RATE = 96_000
    const val NORMAL_VOLUME = 1.0f
    const val DUCKED_VOLUME = 0.25f

    fun createAndroid(context: Context): JarvisPcmStreamPlayer {
      val appContext = context.applicationContext
      return JarvisPcmStreamPlayer(
        trackFactory = AndroidJarvisPcmTrackFactory(),
        audioFocus = AndroidJarvisAudioFocusController(appContext),
      )
    }
  }
}

internal interface JarvisPcmTrackFactory {
  fun create(sampleRate: Int): JarvisPcmTrack
}

internal interface JarvisPcmTrack {
  fun play()
  fun write(samples: FloatArray, offset: Int, length: Int): Int
  fun setVolume(volume: Float)
  fun pause()
  fun flush()
  fun stop()
  fun release()
}

internal interface JarvisAudioFocusController {
  fun request(onLost: () -> Unit, onDuck: () -> Unit, onGain: () -> Unit): Boolean
  fun abandon()
}

private class AndroidJarvisPcmTrackFactory : JarvisPcmTrackFactory {
  override fun create(sampleRate: Int): JarvisPcmTrack {
    val channelMask = AudioFormat.CHANNEL_OUT_MONO
    val encoding = AudioFormat.ENCODING_PCM_FLOAT
    val minimum = AudioTrack.getMinBufferSize(sampleRate, channelMask, encoding)
    require(minimum > 0) { "AudioTrack rejected the requested sample rate" }
    val bufferSize = maxOf(minimum * 2, sampleRate / 5 * Float.SIZE_BYTES)

    val attributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ASSISTANT)
      .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
      .build()
    val format = AudioFormat.Builder()
      .setEncoding(encoding)
      .setSampleRate(sampleRate)
      .setChannelMask(channelMask)
      .build()
    val audioTrack = AudioTrack.Builder()
      .setAudioAttributes(attributes)
      .setAudioFormat(format)
      .setBufferSizeInBytes(bufferSize)
      .setTransferMode(AudioTrack.MODE_STREAM)
      .build()

    if (audioTrack.state != AudioTrack.STATE_INITIALIZED) {
      audioTrack.release()
      throw IllegalStateException("AudioTrack could not be initialized")
    }
    return AndroidJarvisPcmTrack(audioTrack)
  }
}

private class AndroidJarvisPcmTrack(
  private val delegate: AudioTrack,
) : JarvisPcmTrack {
  override fun play() = delegate.play()
  override fun write(samples: FloatArray, offset: Int, length: Int): Int =
    delegate.write(samples, offset, length, AudioTrack.WRITE_NON_BLOCKING)
  override fun setVolume(volume: Float) {
    delegate.setVolume(volume)
  }
  override fun pause() = delegate.pause()
  override fun flush() = delegate.flush()
  override fun stop() = delegate.stop()
  override fun release() = delegate.release()
}

private class AndroidJarvisAudioFocusController(
  context: Context,
) : JarvisAudioFocusController {
  private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private var request: AudioFocusRequest? = null
  private var legacyListener: AudioManager.OnAudioFocusChangeListener? = null

  @Synchronized
  override fun request(onLost: () -> Unit, onDuck: () -> Unit, onGain: () -> Unit): Boolean {
    val listener = AudioManager.OnAudioFocusChangeListener { change ->
      when (change) {
        AudioManager.AUDIOFOCUS_LOSS,
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> onLost()
        AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> onDuck()
        AudioManager.AUDIOFOCUS_GAIN -> onGain()
      }
    }

    val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val attributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANT)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()
      val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(attributes)
        .setOnAudioFocusChangeListener(listener)
        .setAcceptsDelayedFocusGain(false)
        .setWillPauseWhenDucked(false)
        .build()
      val granted = audioManager.requestAudioFocus(focusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
      if (granted) request = focusRequest
      granted
    } else {
      val granted = audioManager.requestAudioFocus(
        listener,
        AudioManager.STREAM_MUSIC,
        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK,
      ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
      if (granted) legacyListener = listener
      granted
    }
    return result
  }

  @Synchronized
  override fun abandon() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      request?.let { audioManager.abandonAudioFocusRequest(it) }
      request = null
    } else {
      legacyListener?.let { audioManager.abandonAudioFocus(it) }
      legacyListener = null
    }
  }
}
