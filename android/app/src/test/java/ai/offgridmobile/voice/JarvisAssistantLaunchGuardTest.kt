package ai.offgridmobile.voice

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class JarvisAssistantLaunchGuardTest {
  @Test
  fun acceptsTheTokenMintedByThePrivateBridgeExactlyOnce() {
    val issuedAt = 10_000L
    val token = JarvisAssistantLaunchGuard.issue(issuedAt)
    assertTrue(JarvisAssistantLaunchGuard.consume(token, issuedAt + 1L))
    assertFalse(JarvisAssistantLaunchGuard.consume(token, issuedAt + 2L))
  }

  @Test
  fun rejectsMissingAndForgedTokens() {
    val issuedAt = 20_000L
    JarvisAssistantLaunchGuard.issue(issuedAt)
    assertFalse(JarvisAssistantLaunchGuard.consume(null, issuedAt + 1L))
    assertFalse(JarvisAssistantLaunchGuard.consume("attacker-controlled", issuedAt + 2L))
  }

  @Test
  fun aNewLaunchInvalidatesThePreviousPendingToken() {
    val issuedAt = 30_000L
    val oldToken = JarvisAssistantLaunchGuard.issue(issuedAt)
    val newToken = JarvisAssistantLaunchGuard.issue(issuedAt + 1L)
    assertNotNull(newToken)
    assertFalse(JarvisAssistantLaunchGuard.consume(oldToken, issuedAt + 2L))
    assertTrue(JarvisAssistantLaunchGuard.consume(newToken, issuedAt + 3L))
  }

  @Test
  fun rejectsAnExpiredBridgeToken() {
    val issuedAt = 1_000L
    val token = JarvisAssistantLaunchGuard.issue(issuedAt)

    assertFalse(
      JarvisAssistantLaunchGuard.consume(
        token,
        issuedAt + JarvisAssistantLaunchGuard.TOKEN_TTL_MS + 1L,
      ),
    )
    assertFalse(JarvisAssistantLaunchGuard.consume(token, issuedAt + 1L))
  }

  @Test
  fun acceptsATokenAtTheExpiryBoundaryAndRejectsClockRollback() {
    val issuedAt = 2_000L
    val token = JarvisAssistantLaunchGuard.issue(issuedAt)
    assertFalse(JarvisAssistantLaunchGuard.consume(token, issuedAt - 1L))

    val freshToken = JarvisAssistantLaunchGuard.issue(issuedAt)
    assertTrue(
      JarvisAssistantLaunchGuard.consume(
        freshToken,
        issuedAt + JarvisAssistantLaunchGuard.TOKEN_TTL_MS,
      ),
    )
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
