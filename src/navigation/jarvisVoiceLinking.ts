import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * System-assistant hand-off. The Android VoiceInteractionSession launches this URI;
 * NavigationContainer resolves it to the existing Chat screen and requests one mic start.
 */
export const JARVIS_VOICE_ASSISTANT_URL =
  'offgrid://assistant/voice?startVoice=1';

export const jarvisVoiceLinking: LinkingOptions<RootStackParamList> = {
  prefixes: ['offgrid://'],
  config: {
    screens: {
      Chat: {
        path: 'assistant/voice',
        parse: {
          startVoice: value => value === '1',
        },
      },
    },
  },
};
