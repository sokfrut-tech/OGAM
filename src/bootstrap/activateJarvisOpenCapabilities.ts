import { registerHook, HOOKS } from './hookRegistry';
import { registerSlot, SLOTS } from './slotRegistry';
import { registerScreen } from '../navigation/screenRegistry';
import { PRO_TOOLS_SCREEN } from '../hooks/useIsProActive';
import { JarvisSpeakButton } from '../components/jarvisPro/JarvisSpeakButton';
import {
  JarvisTtsSettingsSection,
  JarvisTtsSettingsSummary,
} from '../components/jarvisPro/JarvisTtsSettingsSection';
import { JarvisVideoSettingsSection } from '../components/jarvisPro/JarvisVideoSettingsSection';
import { JarvisVoicePanel } from '../screens/jarvisPro/JarvisVoicePanel';
import { JarvisVideoPanel } from '../screens/jarvisPro/JarvisVideoPanel';
import { JarvisProToolsScreen } from '../screens/jarvisPro/JarvisProToolsScreen';
import { jarvisTtsService } from '../services/jarvisPro/jarvisTtsService';
import { jarvisVideoService } from '../services/jarvisPro/jarvisVideoService';
import { registerJarvisMcpExtension } from '../services/jarvisPro/jarvisMcpService';
import {
  discardDeferredJarvisImage,
  finishDeferredJarvisImage,
  hasPendingJarvisImage,
  registerJarvisImageExtension,
} from '../services/jarvisPro/jarvisImageToolExtension';
import { isJarvisStandaloneRuntime } from '../i18n';
import { modelResidencyManager } from '../services/modelResidency';
import { useAppStore } from '../stores';

/**
 * Registers all open-source Pro capabilities (offline RU TTS, local Wan video,
 * and Tools/MCP management) into core registries for standalone Jarvis Ai builds.
 */
export function activateJarvisOpenCapabilities(): void {
  if (
    isJarvisStandaloneRuntime &&
    useAppStore.getState().settings.modelLoadingMode !== 'conservative'
  ) {
    modelResidencyManager.setLoadPolicy('aggressive');
  }

  // Voice hooks (Android offline RU TextToSpeech)
  registerHook(HOOKS.audioCanSpeak, () => jarvisTtsService.canSpeak());
  registerHook(HOOKS.audioSpeak, (text: string, messageId?: string) =>
    jarvisTtsService.speak(text, messageId),
  );
  registerHook(HOOKS.audioIsSpeaking, () => jarvisTtsService.isSpeaking());
  registerHook(HOOKS.audioStop, () => {
    jarvisTtsService.stop().catch(() => {});
  });
  registerHook(HOOKS.audioStopForExit, () => {
    jarvisTtsService.stop().catch(() => {});
  });
  registerHook(HOOKS.audioOnStreamingEnd, (conversationId?: string) => {
    if (conversationId) {
      jarvisTtsService.speakOnStreamEnd(conversationId);
    }
  });

  // Video & deferred image hooks (native liboffgrid_video.so + generate_image tool)
  registerHook(HOOKS.videoIsBusy, () => jarvisVideoService.isBusy());
  registerHook(HOOKS.videoHasPending, () =>
    jarvisVideoService.hasPending() || hasPendingJarvisImage(),
  );
  registerHook(HOOKS.videoCancel, () => jarvisVideoService.cancel());
  registerHook(HOOKS.videoGenerate, input => jarvisVideoService.generateVideo(input));
  registerHook(HOOKS.videoDefer, (conversationId: string, input) =>
    jarvisVideoService.defer(conversationId, input),
  );
  registerHook(
    HOOKS.videoFinishDeferred,
    async (conversationId: string, stopped: boolean) => {
      await jarvisVideoService.finishDeferred(conversationId, stopped);
      await finishDeferredJarvisImage(conversationId, stopped);
    },
  );
  registerHook(HOOKS.videoDiscardDeferred, (conversationId: string) => {
    jarvisVideoService.discardDeferred(conversationId);
    discardDeferredJarvisImage(conversationId);
  });

  // UI slots
  registerSlot(SLOTS.messageSpeakButton, JarvisSpeakButton);
  registerSlot(SLOTS.generationSettingsTts, JarvisTtsSettingsSection);
  registerSlot(SLOTS.generationSettingsTtsSummary, JarvisTtsSettingsSummary);
  registerSlot(SLOTS.generationSettingsVideo, JarvisVideoSettingsSection);
  registerSlot(SLOTS.modelsScreenVoiceTab, JarvisVoicePanel);
  registerSlot(SLOTS.modelsScreenVideoTab, JarvisVideoPanel);
  registerSlot(SLOTS.modelSelectorVideoTab, JarvisVideoPanel);

  // Pro Tools + MCP screen
  registerScreen({
    name: PRO_TOOLS_SCREEN,
    component: JarvisProToolsScreen,
    options: { headerShown: false },
  });

  // User HTTP JSON-RPC MCP tool extension + image generation tool
  registerJarvisMcpExtension();
  registerJarvisImageExtension();

  // Warm local video pack discovery asynchronously
  jarvisVideoService.scanDownloadedVideoPacks().catch(() => {});
}
