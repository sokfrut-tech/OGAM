package ai.offgridmobile.voice

import android.os.SystemClock
import java.util.UUID

/**
 * In-process, one-use authorization for the private assistant bridge.
 *
 * The bridge Activity and MainActivity share the app's main process. The system voice
 * session itself runs in :jarvis_voice and cannot mint or read this token. External apps
 * cannot launch the bridge because it is not exported.
 */
internal object JarvisAssistantLaunchGuard {
  /** A bridge handoff should complete immediately; never leave a valid token pending indefinitely. */
  internal const val TOKEN_TTL_MS = 10_000L

  @Volatile
  private var pendingToken: String? = null
  private var pendingIssuedAtMs: Long? = null

  private val encodedByte = Regex("%([0-9a-fA-F]{2})")

  @Synchronized
  fun issue(nowMs: Long = SystemClock.elapsedRealtime()): String {
    val token = UUID.randomUUID().toString()
    pendingToken = token
    pendingIssuedAtMs = nowMs
    return token
  }

  @Synchronized
  fun consume(
    candidate: String?,
    nowMs: Long = SystemClock.elapsedRealtime(),
  ): Boolean {
    if (candidate == null || candidate != pendingToken) return false
    val issuedAtMs = pendingIssuedAtMs
    val ageMs = issuedAtMs?.let { nowMs - it }
    if (ageMs == null || ageMs < 0L || ageMs > TOKEN_TTL_MS) {
      pendingToken = null
      pendingIssuedAtMs = null
      return false
    }
    pendingToken = null
    pendingIssuedAtMs = null
    return true
  }

  /**
   * Matches every ACTION_VIEW URL form that React Navigation resolves to Chat's
   * assistant/voice path. React Navigation 7.5.1 collapses repeated slashes while
   * extracting the URL path; its 7.24.0 route parser accepts the path with or without
   * a trailing slash and accepts percent-encoded static path characters.
   *
   * Keep this native security boundary at least as permissive as the JS route parser:
   * otherwise an external intent can bypass the token check using a URL spelling that
   * the JS router later normalizes back to the protected assistant route.
   */
  fun matchesAssistantVoiceRoute(uri: String?): Boolean {
    if (uri == null) return false

    val schemeEnd = uri.indexOf(':')
    if (schemeEnd <= 0 || !uri.substring(0, schemeEnd).equals("offgrid", ignoreCase = true)) {
      return false
    }

    // Query and fragment do not participate in React Navigation's route-pattern match.
    val rawPath = uri.substring(schemeEnd + 1).substringBefore('#').substringBefore('?')
    val normalizedPath = rawPath.replace(Regex("/+"), "/").trim('/')
    val decodedStaticCharacters = encodedByte.replace(normalizedPath) { match ->
      val character = match.groupValues[1].toInt(16).toChar()
      if (
        character in 'a'..'z' ||
        character in 'A'..'Z' ||
        character in '0'..'9' ||
        character == '-' ||
        character == '.' ||
        character == '_' ||
        character == '~'
      ) {
        character.toString()
      } else {
        match.value
      }
    }

    return decodedStaticCharacters.equals("assistant/voice", ignoreCase = true)
  }

  @Synchronized
  internal fun resetForTesting() {
    pendingToken = null
    pendingIssuedAtMs = null
  }
}
