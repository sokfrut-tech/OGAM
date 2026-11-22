package ai.offgridmobile.voice

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/**
 * Pure projection of the three Android facts which must all agree before OGAM says
 * that Jarvis is the active system assistant.
 */
internal data class JarvisAssistantRoleSnapshot(
  val supported: Boolean,
  val roleAvailable: Boolean,
  val roleHeld: Boolean,
  val activeService: Boolean,
  val androidApi: Int,
) {
  val ready: Boolean
    get() = supported && roleAvailable && roleHeld && activeService

  fun toWritableMap(): WritableMap = Arguments.createMap().apply {
    putBoolean("supported", supported)
    putBoolean("roleAvailable", roleAvailable)
    putBoolean("roleHeld", roleHeld)
    putBoolean("activeService", activeService)
    putBoolean("ready", ready)
    putInt("androidApi", androidApi)
  }

  companion object {
    fun from(
      androidApi: Int,
      roleAvailable: Boolean,
      roleHeld: Boolean,
      activeService: Boolean,
    ): JarvisAssistantRoleSnapshot {
      val supported = androidApi >= 31
      val available = supported && roleAvailable
      return JarvisAssistantRoleSnapshot(
        supported = supported,
        roleAvailable = available,
        roleHeld = available && roleHeld,
        activeService = supported && activeService,
        androidApi = androidApi,
      )
    }
  }
}
