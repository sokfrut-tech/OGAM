package ai.offgridmobile.voice

import android.service.voice.VoiceInteractionService

/**
 * Lightweight Android entry point registered as the device's default assistant.
 *
 * Keep this class cheap: the actual interaction is created by
 * JarvisVoiceInteractionSessionService in its own process.
 */
class JarvisVoiceInteractionService : VoiceInteractionService()
