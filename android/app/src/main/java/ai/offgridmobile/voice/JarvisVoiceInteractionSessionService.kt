package ai.offgridmobile.voice

import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService

/** Creates one short-lived session for each system assistant invocation. */
class JarvisVoiceInteractionSessionService : VoiceInteractionSessionService() {
  override fun onNewSession(args: Bundle?): VoiceInteractionSession {
    return JarvisVoiceInteractionSession(this)
  }
}
