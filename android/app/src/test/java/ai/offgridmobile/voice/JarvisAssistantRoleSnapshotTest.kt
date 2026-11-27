package ai.offgridmobile.voice

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class JarvisAssistantRoleSnapshotTest {

  @Test
  fun android11DoesNotExposeTheAndroid12SystemAssistantIntegration() {
    val status = JarvisAssistantRoleSnapshot.from(
      androidApi = 30,
      roleAvailable = true,
      roleHeld = true,
      activeService = true,
    )

    assertFalse(status.supported)
    assertFalse(status.roleAvailable)
    assertFalse(status.roleHeld)
    assertFalse(status.activeService)
    assertFalse(status.ready)
  }

  @Test
  fun unavailableAssistantRoleCannotBeReportedAsReady() {
    val status = JarvisAssistantRoleSnapshot.from(
      androidApi = 31,
      roleAvailable = false,
      roleHeld = true,
      activeService = true,
    )

    assertTrue(status.supported)
    assertFalse(status.roleAvailable)
    assertFalse(status.roleHeld)
    assertFalse(status.ready)
  }

  @Test
  fun grantedRoleIsNotTheSameAsAnActiveVoiceInteractionService() {
    val status = JarvisAssistantRoleSnapshot.from(
      androidApi = 35,
      roleAvailable = true,
      roleHeld = true,
      activeService = false,
    )

    assertTrue(status.roleHeld)
    assertFalse(status.activeService)
    assertFalse(status.ready)
  }

  @Test
  fun activeServiceWithoutRoleHolderIsNotReady() {
    val status = JarvisAssistantRoleSnapshot.from(
      androidApi = 35,
      roleAvailable = true,
      roleHeld = false,
      activeService = true,
    )

    assertFalse(status.roleHeld)
    assertTrue(status.activeService)
    assertFalse(status.ready)
  }

  @Test
  fun onlyRoleHolderWithActiveServiceIsReady() {
    val status = JarvisAssistantRoleSnapshot.from(
      androidApi = 35,
      roleAvailable = true,
      roleHeld = true,
      activeService = true,
    )

    assertTrue(status.supported)
    assertTrue(status.roleAvailable)
    assertTrue(status.roleHeld)
    assertTrue(status.activeService)
    assertTrue(status.ready)
  }
}
