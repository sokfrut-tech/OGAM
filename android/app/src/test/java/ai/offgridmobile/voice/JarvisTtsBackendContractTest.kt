package ai.offgridmobile.voice

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test

class JarvisTtsBackendContractTest {
  @Test
  fun requestRejectsBlankTextAndInvalidSpeed() {
    assertThrows(IllegalArgumentException::class.java) {
      JarvisTtsRequest(requestId = 1L, text = "   ")
    }
    assertThrows(IllegalArgumentException::class.java) {
      JarvisTtsRequest(requestId = 1L, text = "Привет", speed = Float.NaN)
    }
    assertThrows(IllegalArgumentException::class.java) {
      JarvisTtsRequest(requestId = 1L, text = "Привет", speed = 2.1f)
    }
  }

  @Test
  fun resultComputesDurationFromPcmSamplesAndSampleRate() {
    val result = JarvisTtsResult(
      requestId = 7L,
      sampleRateHz = 24_000,
      emittedChunks = 3,
      audioSamples = 48_000L,
      cancelled = false,
    )

    assertEquals(2_000L, result.audioDurationMs)
  }

  @Test
  fun batchAndStreamingCapabilitiesRemainExplicit() {
    val batch = JarvisTtsCapabilities(
      outputMode = JarvisTtsOutputMode.BATCH,
      supportsNativeCancellation = false,
    )
    val streaming = JarvisTtsCapabilities(
      outputMode = JarvisTtsOutputMode.MODEL_STREAMING,
      supportsNativeCancellation = true,
      supportsVoiceCloning = true,
      supportedLanguageTags = setOf("ru-RU", "de-DE"),
    )

    assertFalse(batch.supportsNativeCancellation)
    assertEquals(JarvisTtsOutputMode.MODEL_STREAMING, streaming.outputMode)
    assertTrue(streaming.supportsVoiceCloning)
    assertTrue("ru-RU" in streaming.supportedLanguageTags)
  }
}
