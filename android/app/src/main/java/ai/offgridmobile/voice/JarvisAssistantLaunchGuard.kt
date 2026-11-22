package ai.offgridmobile.voice

import java.util.UUID

/**
 * In-process, one-use authorization for the private assistant bridge.
 *
 * The bridge Activity and MainActivity share the app's main process. The system voice
 * session itself runs in :jarvis_voice and cannot mint or read this token. External apps
 * cannot launch the bridge because it is not exported.
 */
internal object JarvisAssistantLaunchGuard {
  @Volatile
  private var pendingToken: String? = null

  @Synchronized
  fun issue(): String {
    val token = UUID.randomUUID().toString()
    pendingToken = token
    return token
  }

  @Synchronized
  fun consume(candidate: String?): Boolean {
    if (candidate == null || candidate != pendingToken) return false
    pendingToken = null
    return true
  }

  @Synchronized
  internal fun resetForTesting() {
    pendingToken = null
  }
}
