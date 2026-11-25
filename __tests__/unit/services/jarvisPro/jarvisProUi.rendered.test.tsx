import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import { JarvisSpeakButton } from '../../../../src/components/jarvisPro/JarvisSpeakButton';
import {
  JarvisTtsSettingsSection,
  JarvisTtsSettingsSummary,
} from '../../../../src/components/jarvisPro/JarvisTtsSettingsSection';
import { JarvisVideoSettingsSection } from '../../../../src/components/jarvisPro/JarvisVideoSettingsSection';
import { JarvisProToolsScreen } from '../../../../src/screens/jarvisPro/JarvisProToolsScreen';
import { JarvisVideoPanel } from '../../../../src/screens/jarvisPro/JarvisVideoPanel';
import { JarvisVoicePanel } from '../../../../src/screens/jarvisPro/JarvisVoicePanel';
import { hardwareService } from '../../../../src/services/hardware';
import { completeVideoPacks } from '../../../../src/services/phoneVideoPacks';
import { useAppStore } from '../../../../src/stores/appStore';
import { useJarvisProStore } from '../../../../src/stores/jarvisProStore';
import { withNavigatorRoutes } from '../../../harness/realNavigation';

jest.unmock('@react-navigation/native');

jest.mock('react-native-vector-icons/Feather', () => {
  const { Text } = require('react-native');
  return ({ name, ...props }: any) => <Text {...props}>{name}</Text>;
});

describe('Jarvis Pro UI Components and Screens', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    useJarvisProStore.setState({
      ttsAutoSpeak: false,
      ttsRate: 1.0,
      ttsVoiceId: null,
      ttsSpeakingMessageId: null,
      selectedVideoPackId: null,
      downloadedVideoPackIds: [],
      videoDownloadingPackId: null,
      videoDownloadProgress: 0,
      videoGenerating: false,
      videoStage: null,
      videoStep: 0,
      videoTotalSteps: 0,
      videoError: null,
      videoBackend: 'auto',
      mcpServers: [],
    });
    useAppStore.getState().updateSettings({ enabledTools: ['calculator'] });
    NativeModules.JarvisAndroidTtsModule = {
      isAvailable: jest.fn(async () => true),
      speak: jest.fn(async () => true),
      stop: jest.fn(async () => true),
      isSpeaking: jest.fn(async () => false),
      getVoices: jest.fn(async () => [
        {
          id: 'ru-ru-x-ruf-local',
          name: 'Русский (офлайн)',
          locale: 'ru-RU',
          networkRequired: false,
        },
      ]),
    };
    NativeModules.VideoGenerationModule = {
      generate: jest.fn(async ({ outputPath }: { outputPath: string }) => ({ path: outputPath })),
      cancel: jest.fn(async () => undefined),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    delete NativeModules.JarvisAndroidTtsModule;
    delete NativeModules.VideoGenerationModule;
  });

  it('renders JarvisSpeakButton only for non-empty text and toggles speak/stop', async () => {
    const empty = render(<JarvisSpeakButton text="   " messageId="m0" />);
    expect(empty.queryByTestId('jarvis-speak-button')).toBeNull();

    const ui = render(<JarvisSpeakButton text="**Ответ**" messageId="m1" />);
    fireEvent.press(ui.getByTestId('jarvis-speak-button'));
    await waitFor(() => expect(NativeModules.JarvisAndroidTtsModule.speak).toHaveBeenCalled());

    expect(ui.getByTestId('jarvis-speak-stop-button')).toBeTruthy();
    fireEvent.press(ui.getByTestId('jarvis-speak-stop-button'));
    await waitFor(() => expect(NativeModules.JarvisAndroidTtsModule.stop).toHaveBeenCalled());
  });

  it('renders TTS settings summary/section and Video settings section', async () => {
    const ui = render(
      <>
        <JarvisTtsSettingsSummary />
        <JarvisTtsSettingsSection />
        <JarvisVideoSettingsSection alwaysOpen />
        <JarvisVideoSettingsSection />
      </>,
    );

    expect(ui.getByText('Выкл · 1.0x')).toBeTruthy();
    fireEvent.press(ui.getByTestId('jarvis-tts-rate-1.5'));
    expect(useJarvisProStore.getState().ttsRate).toBe(1.5);
    fireEvent.press(ui.getByTestId('jarvis-tts-test-button'));
    await waitFor(() => expect(NativeModules.JarvisAndroidTtsModule.speak).toHaveBeenCalled());

    fireEvent.press(ui.getByTestId('jarvis-video-backend-gpu'));
    expect(useJarvisProStore.getState().videoBackend).toBe('gpu');
  });

  it('renders JarvisVoicePanel with Android voices and rate/test controls', async () => {
    const ui = render(<JarvisVoicePanel showRemoteModels />);

    await waitFor(() =>
      expect(ui.getByTestId('jarvis-voice-option-ru-ru-x-ruf-local')).toBeTruthy(),
    );
    fireEvent.press(ui.getByTestId('jarvis-voice-option-ru-ru-x-ruf-local'));
    expect(useJarvisProStore.getState().ttsVoiceId).toBe('ru-ru-x-ruf-local');

    fireEvent.press(ui.getByTestId('jarvis-voice-rate-1.2'));
    expect(useJarvisProStore.getState().ttsRate).toBe(1.2);

    fireEvent.press(ui.getByTestId('jarvis-voice-test-button'));
    await waitFor(() => expect(NativeModules.JarvisAndroidTtsModule.speak).toHaveBeenCalled());
  });

  it('renders JarvisVideoPanel with empty prompt error, generation, and pack actions', async () => {
    jest.spyOn(RNFS, 'exists').mockResolvedValue(false);
    jest.spyOn(hardwareService, 'getTotalMemoryGB').mockReturnValue(12);
    const pack = completeVideoPacks()[0];

    const onSelect = jest.fn();
    const ui = render(
      withNavigatorRoutes(<JarvisVideoPanel onSelect={onSelect} />, {
        destinations: ['Gallery'],
      }),
    );

    fireEvent.press(ui.getByTestId('jarvis-video-generate-button'));
    expect(ui.getByText('Введите описание сцены для генерации видео.')).toBeTruthy();

    useJarvisProStore.setState({
      downloadedVideoPackIds: [pack.id],
      selectedVideoPackId: pack.id,
    });
    fireEvent.press(ui.getByTestId(`jarvis-video-pack-select-${pack.id}`));
    expect(onSelect).toHaveBeenCalled();

    fireEvent.press(ui.getByTestId('jarvis-video-open-gallery'));
    await waitFor(() => expect(ui.getByTestId('route-Gallery')).toBeTruthy());
  });

  it('renders JarvisProToolsScreen with tool toggles and MCP server management', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        result: { tools: [{ name: 'ping', description: 'Check server' }] },
      }),
    })) as any;

    const ui = render(
      withNavigatorRoutes(<JarvisProToolsScreen />, {
        destinations: ['Main'],
      }),
    );

    fireEvent.press(ui.getByTestId('jarvis-tools-enable-all'));
    expect(useAppStore.getState().settings.enabledTools.length).toBeGreaterThan(2);

    fireEvent.press(ui.getByTestId('jarvis-tools-disable-all'));
    expect(useAppStore.getState().settings.enabledTools).toEqual([]);

    fireEvent.changeText(ui.getByTestId('jarvis-mcp-url-input'), 'ftp://invalid');
    fireEvent.press(ui.getByTestId('jarvis-mcp-add-button'));
    await waitFor(() =>
      expect(ui.getByText('Поддерживаются только протоколы http:// и https://.')).toBeTruthy(),
    );

    fireEvent.changeText(ui.getByTestId('jarvis-mcp-name-input'), 'Dev MCP');
    fireEvent.changeText(ui.getByTestId('jarvis-mcp-url-input'), 'https://mcp.example/rpc');
    fireEvent.press(ui.getByTestId('jarvis-mcp-add-button'));
    await waitFor(() => expect(ui.getByText('Dev MCP')).toBeTruthy());
    expect(ui.getByText('ping')).toBeTruthy();
  });
});
