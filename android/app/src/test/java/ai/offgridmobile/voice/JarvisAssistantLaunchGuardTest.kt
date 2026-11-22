package ai.offgridmobile.voice

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class JarvisAssistantLaunchGuardTest {
  @Test
  fun acceptsTheTokenMintedByThePrivateBridgeExactlyOnce() {
    val token = JarvisAssistantLaunchGuard.issue()
    assertTrue(JarvisAssistantLaunchGuard.consume(token))
    assertFalse(JarvisAssistantLaunchGuard.consume(token))
  }

  @Test
  fun rejectsMissingAndForgedTokens() {
    JarvisAssistantLaunchGuard.issue()
    assertFalse(JarvisAssistantLaunchGuard.consume(null))
    assertFalse(JarvisAssistantLaunchGuard.consume("attacker-controlled"))
  }

  @Test
  fun aNewLaunchInvalidatesThePreviousPendingToken() {
    val oldToken = JarvisAssistantLaunchGuard.issue()
    val newToken = JarvisAssistantLaunchGuard.issue()
    assertNotNull(newToken)
    assertFalse(JarvisAssistantLaunchGuard.consume(oldToken))
    assertTrue(JarvisAssistantLaunchGuard.consume(newToken))
  }

  @Test
  fun matchesCanonicalAssistantVoiceRoute() {
    assertTrue(
      JarvisAssistantLaunchGuard.matchesAssistantVoiceRoute(
        "offgrid://assistant/voice?startVoice=1",
      ),
    )
  }

  @Test
  fun matchesTrailingAndRepeatedSlashesNormalizedByReactNavigation() {
    val equivalentUrls = listOf(
      "offgrid://assistant/voice/?startVoice=1",
      "offgrid://assistant/voice///?startVoice=1",
      "offgrid://assistant//voice?startVoice=1",
      "offgrid:///assistant//voice///?startVoice=1",
      "offgrid:/assistant/voice/?startVoice=1",
      "offgrid:assistant/voice/?startVoice=1",
    )

    equivalentUrls.forEach { url ->
      assertTrue("Expected protected assistant route: $url",
        JarvisAssistantLaunchGuard.matchesAssistantVoiceRoute(url))
    }
  }

  @Test
  fun matchesPercentEncodedStaticCharactersAcceptedByReactNavigation() {
    val equivalentUrls = listOf(
      "offgrid://%61ssistant/voice?startVoice=1",
      "offgrid://assistant/%76oice/?startVoice=1",
      "offgrid://%61ssistant/%76oice///?startVoice=1",
    )

    equivalentUrls.forEach { url ->
      assertTrue("Expected protected assistant route: $url",
        JarvisAssistantLaunchGuard.matchesAssistantVoiceRoute(url))
    }
  }

  @Test
  fun doesNotMatchOtherOffgridRoutesOrMalformedSchemes() {
    val unrelatedUrls = listOf(
      "offgrid://oauth/callback?code=abc",
      "offgrid://pro/unlock",
      "offgrid://assistant/settings",
      "offgrid://assistant/voice/extra?startVoice=1",
      "offgrid://other/assistant/voice?startVoice=1",
      "https://assistant/voice?startVoice=1",
      "offgrid-assistant://assistant/voice",
      "assistant/voice",
    )

    unrelatedUrls.forEach { url ->
      assertFalse("Unexpected assistant route match: $url",
        JarvisAssistantLaunchGuard.matchesAssistantVoiceRoute(url))
    }
    assertFalse(JarvisAssistantLaunchGuard.matchesAssistantVoiceRoute(null))
  }
}
