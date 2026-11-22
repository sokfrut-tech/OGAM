package ai.offgridmobile.voice

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import ai.offgridmobile.MainActivity

/**
 * Hands the system invocation to OGAM's existing ChatScreen / ChatInput voice pipeline.
 *
 * This session deliberately does not request SHOW_WITH_ASSIST or SHOW_WITH_SCREENSHOT:
 * no foreground-app text, hierarchy, screenshot or audio is collected at this stage.
 * The app obtains microphone access through its existing user-visible permission path.
 */
class JarvisVoiceInteractionSession(context: android.content.Context) :
  VoiceInteractionSession(context) {

  init {
    // The actual UI is the app's Jarvis/Chat screen, started as an assistant activity.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      setUiEnabled(false)
    }
  }

  override fun onShow(args: Bundle?, showFlags: Int) {
    super.onShow(args, showFlags)

    val launchIntent = Intent(getContext(), MainActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse(JARVIS_VOICE_URI)
      addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      startAssistantActivity(launchIntent)
    } else {
      // Kept as a defensive fallback. The manifest gates this system-assistant service
      // off below API 31 until a local legacy RecognitionService is implemented.
      startVoiceActivity(launchIntent)
    }
    finish()
  }

  companion object {
    const val JARVIS_VOICE_URI = "offgrid://assistant/voice?startVoice=1"
  }
}
