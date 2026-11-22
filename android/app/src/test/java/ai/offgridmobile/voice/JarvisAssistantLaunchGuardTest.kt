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
}
