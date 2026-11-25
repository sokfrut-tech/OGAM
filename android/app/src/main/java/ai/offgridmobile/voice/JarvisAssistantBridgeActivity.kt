package ai.offgridmobile.voice

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import ai.offgridmobile.MainActivity

/**
 * Non-exported hop from the system-bound voice session into the normal app process.
 * Only this private Activity can mint the one-shot launch token accepted by MainActivity.
 */
class JarvisAssistantBridgeActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val token = JarvisAssistantLaunchGuard.issue()
    val launchIntent = Intent(this, MainActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse(JARVIS_VOICE_URI)
      putExtra(EXTRA_LAUNCH_TOKEN, token)
      addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    startActivity(launchIntent)
    finish()
  }

  companion object {
    const val EXTRA_LAUNCH_TOKEN = "ai.offgridmobile.extra.JARVIS_LAUNCH_TOKEN"
    const val JARVIS_VOICE_URI = "offgrid://assistant/voice?startVoice=1"
  }
}
