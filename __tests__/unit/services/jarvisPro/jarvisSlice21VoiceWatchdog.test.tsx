import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { generationService } from '../../../../src/services';
import {
  isLikelyWrongLanguageForRussian,
  jarvisSttService,
} from '../../../../src/services/jarvisPro/jarvisSttService';
import { isEnglishOnlyWhisperModel } from '../../../../src/services/whisperModels';
import { JarvisAudioEmptyHero } from '../../../../src/screens/jarvisPro/JarvisVoiceModeComponents';
import { JarvisVoicePanel } from '../../../../src/screens/jarvisPro/JarvisVoicePanel';
import { useJarvisProStore } from '../../../../src/stores/jarvisProStore';
import { useUiModeStore } from '../../../../src/stores/uiModeStore';
import { useWhisperStore } from '../../../../src/stores/whisperStore';
import { withNavigatorRoutes } from '../../../harness/realNavigation';

jest.unmock('@react-navigation/native');

jest.mock('react-native-vector-icons/Feather', () => {
  const { Text } = require('react-native');
  return ({ name, ...props }: any) => <Text {...props}>{name}</Text>;
});

describe('Jarvis Slice 21: Russian STT Accuracy, UI Diagnostics & Watchdog Bridge', () => {
  const originalPlatformOs = Platform.OS;
  const originalPermCheck = PermissionsAndroid.check;
  const originalPermRequest = PermissionsAndroid.request;

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'android';
    useWhisperStore.setState({
      downloadedModelId: null,
      transcriptionLanguage: 'ru',
    });
    useUiModeStore.setState({ interfaceMode: 'chat', voiceSummary: 'Jarvis TTS · RU' });
    useJarvisProStore.setState({
      ttsAutoSpeak: false,
      ttsRate: 1.0,
      ttsVoiceId: null,
      ttsSpeakingMessageId: null,
    });
    PermissionsAndroid.check = (async () => true) as typeof PermissionsAndroid.check;
    PermissionsAndroid.request = (async () => PermissionsAndroid.RESULTS.GRANTED) as typeof PermissionsAndroid.request;
    NativeModules.JarvisAndroidSttModule = {
      isAvailable: jest.fn(async () => true),
      getEngineInfo: jest.fn(async () => ({
        available: true,
        servicePackage: 'com.google.android.tts',
        isGoogleService: true,
      })),
      startListening: jest.fn(async () => true),
      stopListening: jest.fn(async () => true),
      cancel: jest.fn(async () => true),
    };
    NativeModules.JarvisAndroidTtsModule = {
      isAvailable: jest.fn(async () => true),
      speak: jest.fn(async () => true),
      speakQueued: jest.fn(async () => true),
      stop: jest.fn(async () => true),
      isSpeaking: jest.fn(async () => false),
      getVoices: jest.fn(async () => []),
    };
  });

  afterEach(async () => {
    await jarvisSttService.cancel();
    jest.restoreAllMocks();
    (Platform as { OS: string }).OS = originalPlatformOs;
    PermissionsAndroid.check = originalPermCheck;
    PermissionsAndroid.request = originalPermRequest;
    delete NativeModules.JarvisAndroidSttModule;
    delete NativeModules.JarvisAndroidTtsModule;
    useWhisperStore.setState({ downloadedModelId: null, transcriptionLanguage: 'ru' });
    useUiModeStore.setState({ interfaceMode: 'chat', voiceSummary: null });
  });

  it('detects wrong CJK/English output when ru-RU is expected while allowing mixed/Cyrillic text', () => {
    expect(isLikelyWrongLanguageForRussian('你好世界', 'ru-RU')).toBe(true);
    expect(isLikelyWrongLanguageForRussian('Open the camera please', 'ru-RU')).toBe(true);
    expect(isLikelyWrongLanguageForRussian('Привет, поставь таймер', 'ru-RU')).toBe(false);
    expect(isLikelyWrongLanguageForRussian('Включи Wi-Fi пожалуйста', 'ru-RU')).toBe(false);
    expect(isLikelyWrongLanguageForRussian('OK', 'ru-RU')).toBe(false);
    expect(isLikelyWrongLanguageForRussian('Hello world from phone', 'en-US')).toBe(false);
  });

  it('defaults native STT preferOffline to false, rejects wrong-language results, and reports engine info', async () => {
    const info = await jarvisSttService.getEngineInfo();
    expect(info).toEqual({
      available: true,
      servicePackage: 'com.google.android.tts',
      isGoogleService: true,
    });

    const onResult = jest.fn();
    const onError = jest.fn();
    const onEnd = jest.fn();
    expect(
      await jarvisSttService.startListening({
        language: 'ru',
        onResult,
        onError,
        onEnd,
      }),
    ).toBe(true);
    expect(NativeModules.JarvisAndroidSttModule.startListening).toHaveBeenCalledWith('ru-RU', false);

    DeviceEventEmitter.emit('JarvisSttResult', { text: '你好世界' });
    expect(onResult).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Whisper Small'));
    expect(onEnd).toHaveBeenCalledTimes(1);

    expect(
      await jarvisSttService.startListening({
        language: 'ru',
        onResult,
        onError,
        onEnd,
      }),
    ).toBe(true);
    DeviceEventEmitter.emit('JarvisSttResult', { text: 'Привет мир' });
    expect(onResult).toHaveBeenCalledWith('Привет мир');

    delete NativeModules.JarvisAndroidSttModule;
    expect(await jarvisSttService.getEngineInfo()).toEqual({
      available: false,
      servicePackage: 'unknown',
      isGoogleService: false,
    });
  });

  it('identifies English-only Whisper models and delegates native generation diagnostics cleanly', () => {
    expect(isEnglishOnlyWhisperModel('tiny.en')).toBe(true);
    expect(isEnglishOnlyWhisperModel('base.en')).toBe(true);
    expect(isEnglishOnlyWhisperModel('small.en')).toBe(true);
    expect(isEnglishOnlyWhisperModel('medium.en')).toBe(true);
    expect(isEnglishOnlyWhisperModel('small')).toBe(false);
    expect(isEnglishOnlyWhisperModel('large-v3-turbo')).toBe(false);
    expect(isEnglishOnlyWhisperModel('ggml-org/Qwen3-ASR-0.6B-GGUF')).toBe(false);
    expect(isEnglishOnlyWhisperModel(null)).toBe(false);

    const initial = generationService.getNativeGenerationDiagnostics();
    expect(initial.phase).toBe('idle');
    const seen: string[] = [];
    const unsubscribe = generationService.subscribeNativeGenerationDiagnostics(d => seen.push(d.phase));
    expect(seen).toEqual(['idle']);
    unsubscribe();
  });

  it('renders active STT source in Voice Mode hero and Voice Panel and navigates to Transcription tab', async () => {
    const heroUi = render(
      withNavigatorRoutes(<JarvisAudioEmptyHero />, { destinations: ['Main'] }),
    );
    expect(heroUi.getByText(/Android STT \(RU\)/)).toBeTruthy();
    fireEvent.press(heroUi.getByTestId('jarvis-voice-open-stt-models'));
    await waitFor(() => expect(heroUi.getByTestId('route-Main')).toBeTruthy());

    useWhisperStore.setState({ downloadedModelId: 'small', transcriptionLanguage: 'ru' });
    const heroMulti = render(<JarvisAudioEmptyHero />);
    expect(heroMulti.getByText(/Whisper Small \(RU\)/)).toBeTruthy();
    expect(heroMulti.queryByTestId('jarvis-voice-open-stt-models')).toBeNull();

    const panelUi = render(
      withNavigatorRoutes(<JarvisVoicePanel />, { destinations: ['Main'] }),
    );
    await waitFor(() =>
      expect(panelUi.getByText(/Активная модель: Whisper Small/)).toBeTruthy(),
    );

    useWhisperStore.setState({ downloadedModelId: 'base.en', transcriptionLanguage: 'ru' });
    const panelEn = render(
      withNavigatorRoutes(<JarvisVoicePanel />, { destinations: ['Main'] }),
    );
    await waitFor(() =>
      expect(panelEn.getByText(/английская модель \(base\.en\)/)).toBeTruthy(),
    );
    fireEvent.press(panelEn.getByTestId('jarvis-voice-open-stt-models'));
    await waitFor(() => expect(panelEn.getByTestId('route-Main')).toBeTruthy());
  });
});
