package ai.offgridmobile.voice

import android.service.voice.VoiceInteractionService
import android.service.voice.VoiceInteractionSession

/**
 * Lightweight Android entry point registered as the device's default assistant.
 *
 * Keep this class cheap: the actual interaction is created by
 * JarvisVoiceInteractionSessionService in its own process.
 */
class JarvisVoiceInteractionService : VoiceInteractionService() {
  override fun onReady() {
    super.onReady()
    // The system may offer assist/screenshot context with an assistant invocation.
    // Keep both sources disabled until OGAM ships a separate, consented assist-context flow.
    setDisabledShowContext(
      VoiceInteractionSession.SHOW_WITH_ASSIST or
        VoiceInteractionSession.SHOW_WITH_SCREENSHOT,
    )
  }
}
