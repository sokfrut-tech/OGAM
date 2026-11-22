package ai.offgridmobile.voice

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

class JarvisPcmStreamPlayerTest {

  @Test
  fun writesPartialChunksInOrderAndFinishesTheCurrentGeneration() {
    val track = FakeTrack(maxWrite = 2)
    val focus = FakeFocus()
    val player = JarvisPcmStreamPlayer(FakeTrackFactory(track), focus)

    val generation = player.begin(24_000)
    assertNotNull(generation)
    assertTrue(player.write(generation!!, floatArrayOf(1f, 2f, 3f, 4f, 5f)))
    assertTrue(player.write(generation, floatArrayOf(6f, 7f), 0, 2))
    player.finish(generation)

    assertArrayEquals(floatArrayOf(1f, 2f, 3f, 4f, 5f, 6f, 7f), track.written.toFloatArray(), 0f)
    assertTrue(track.played)
    assertTrue(track.stopped)
    assertTrue(track.released)
    assertEquals(1, focus.requests)
    assertEquals(1, focus.abandons)
    assertFalse(player.isActive)
  }

  @Test
  fun cancelInvalidatesLateChunksAndReleasesTheTrackImmediately() {
    val track = FakeTrack()
    val focus = FakeFocus()
    val player = JarvisPcmStreamPlayer(FakeTrackFactory(track), focus)
    val generation = player.begin(22_050)!!

    player.cancel(generation)

    assertFalse(player.write(generation, floatArrayOf(0.1f, 0.2f)))
    assertTrue(track.paused)
    assertTrue(track.flushed)
    assertTrue(track.released)
    assertEquals(1, focus.abandons)
    assertFalse(player.isActive)
  }

  @Test
  fun staleGenerationCannotFinishOrCancelANewerReply() {
    val first = FakeTrack()
    val second = FakeTrack()
    val factory = QueueTrackFactory(first, second)
    val player = JarvisPcmStreamPlayer(factory, FakeFocus())

    val firstGeneration = player.begin(24_000)!!
    player.cancel(firstGeneration)
    val secondGeneration = player.begin(24_000)!!

    player.finish(firstGeneration)
    player.cancel(firstGeneration)

    assertTrue(player.isActive)
    assertTrue(player.write(secondGeneration, floatArrayOf(0.4f)))
    player.finish(secondGeneration)
    assertTrue(second.released)
  }

  @Test
  fun invalidSampleRateDoesNotRequestFocusOrCreateATrack() {
    val factory = FakeTrackFactory(FakeTrack())
    val focus = FakeFocus()
    val player = JarvisPcmStreamPlayer(factory, focus)

    assertNull(player.begin(7_999))
    assertNull(player.begin(96_001))
    assertEquals(0, focus.requests)
    assertEquals(0, factory.creations)
  }

  @Test
  fun focusDenialDoesNotStartPlayback() {
    val track = FakeTrack()
    val factory = FakeTrackFactory(track)
    val focus = FakeFocus(granted = false)
    val player = JarvisPcmStreamPlayer(factory, focus)

    assertNull(player.begin(24_000))
    assertFalse(player.isActive)
    assertEquals(0, factory.creations)
    assertEquals(1, focus.requests)
  }

  @Test
  fun lateTrackCreationFromCancelledStartCannotAbandonNewerFocus() {
    val firstTrack = FakeTrack()
    val secondTrack = FakeTrack()
    val factory = BlockingFirstTrackFactory(firstTrack, secondTrack)
    val focus = FakeFocus()
    val player = JarvisPcmStreamPlayer(factory, focus)
    val firstGeneration = AtomicReference<Long?>(null)

    val oldStarter = Thread {
      firstGeneration.set(player.begin(24_000))
    }
    oldStarter.start()

    assertTrue(factory.firstCreateStarted.await(2, TimeUnit.SECONDS))
    // The original start is still creating AudioTrack. Cancel it before its
    // candidate exists, then start a newer answer and acquire focus again.
    player.cancel()
    val currentGeneration = player.begin(24_000)!!

    factory.releaseFirstCreate.countDown()
    oldStarter.join(2_000)

    assertFalse(oldStarter.isAlive)
    assertNull(firstGeneration.get())
    assertTrue(player.isActive)
    assertEquals(1, focus.abandons) // only the old generation's cancellation
    assertTrue(player.write(currentGeneration, floatArrayOf(0.5f)))
    assertFalse(secondTrack.released)
    player.finish(currentGeneration)
  }

  @Test
  fun focusLossCancelsTheCurrentGeneration() {
    val track = FakeTrack()
    val focus = FakeFocus()
    val player = JarvisPcmStreamPlayer(FakeTrackFactory(track), focus)
    val generation = player.begin(24_000)!!

    focus.loseFocus()

    assertFalse(player.isActive)
    assertFalse(player.write(generation, floatArrayOf(0.3f)))
    assertTrue(track.released)
    assertEquals(1, focus.abandons)
  }

  @Test
  fun duckingAndFocusGainAdjustOnlyTheCurrentTrackVolume() {
    val track = FakeTrack()
    val focus = FakeFocus()
    val player = JarvisPcmStreamPlayer(FakeTrackFactory(track), focus)
    val generation = player.begin(24_000)!!

    focus.duck()
    assertEquals(JarvisPcmStreamPlayer.DUCKED_VOLUME, track.volume, 0f)
    focus.gain()
    assertEquals(JarvisPcmStreamPlayer.NORMAL_VOLUME, track.volume, 0f)

    player.finish(generation)
    focus.duck()
    assertEquals(JarvisPcmStreamPlayer.NORMAL_VOLUME, track.volume, 0f)
  }

  private class FakeTrackFactory(
    private val track: FakeTrack,
  ) : JarvisPcmTrackFactory {
    var creations = 0
    override fun create(sampleRate: Int): JarvisPcmTrack {
      creations += 1
      return track
    }
  }

  private class QueueTrackFactory(
    private vararg val tracks: FakeTrack,
  ) : JarvisPcmTrackFactory {
    private var index = 0
    override fun create(sampleRate: Int): JarvisPcmTrack = tracks[index++]
  }

  private class BlockingFirstTrackFactory(
    private val first: FakeTrack,
    private val second: FakeTrack,
  ) : JarvisPcmTrackFactory {
    val firstCreateStarted = CountDownLatch(1)
    val releaseFirstCreate = CountDownLatch(1)
    private val calls = AtomicInteger(0)

    override fun create(sampleRate: Int): JarvisPcmTrack {
      return if (calls.getAndIncrement() == 0) {
        firstCreateStarted.countDown()
        check(releaseFirstCreate.await(2, TimeUnit.SECONDS))
        first
      } else {
        second
      }
    }
  }

  private class FakeTrack(
    private val maxWrite: Int = Int.MAX_VALUE,
  ) : JarvisPcmTrack {
    val written = mutableListOf<Float>()
    var played = false
    var paused = false
    var flushed = false
    var stopped = false
    var released = false
    var volume = 1f

    override fun play() { played = true }
    override fun write(samples: FloatArray, offset: Int, length: Int): Int {
      if (released) return -1
      val count = minOf(length, maxWrite)
      repeat(count) { written += samples[offset + it] }
      return count
    }
    override fun setVolume(volume: Float) { this.volume = volume }
    override fun pause() { paused = true }
    override fun flush() { flushed = true }
    override fun stop() { stopped = true }
    override fun release() { released = true }
  }

  private class FakeFocus(
    private val granted: Boolean = true,
  ) : JarvisAudioFocusController {
    var requests = 0
    var abandons = 0
    private var onLost: (() -> Unit)? = null
    private var onDuck: (() -> Unit)? = null
    private var onGain: (() -> Unit)? = null

    override fun request(onLost: () -> Unit, onDuck: () -> Unit, onGain: () -> Unit): Boolean {
      requests += 1
      this.onLost = onLost
      this.onDuck = onDuck
      this.onGain = onGain
      return granted
    }
    override fun abandon() { abandons += 1 }
    fun loseFocus() { onLost?.invoke() }
    fun duck() { onDuck?.invoke() }
    fun gain() { onGain?.invoke() }
  }
}
