import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import RNFS from 'react-native-fs';
import { HOOKS, callHook, hasHook } from '../../../../src/bootstrap/hookRegistry';
import { SLOTS, _clearSlotsForTesting, getSlot } from '../../../../src/bootstrap/slotRegistry';
import { activateJarvisOpenCapabilities } from '../../../../src/bootstrap/activateJarvisOpenCapabilities';
import { hideAlert } from '../../../../src/components/CustomAlert';
import { TouchableOpacity } from '../../../../src/components/Touchable';
import { _clearScreensForTesting, getRegisteredScreens } from '../../../../src/navigation/screenRegistry';
import {
  JarvisAudioComposer,
  JarvisAudioEmptyHero,
  JarvisAudioMessage,
  JarvisChatModeToggle,
  JarvisQuickSettingsAudioRow,
} from '../../../../src/screens/jarvisPro/JarvisVoiceModeComponents';
import {
  JarvisAnimateImageAction,
  JarvisGalleryVideoSection,
  JarvisVideoMessageCard,
  JarvisVideoStatusBanner,
} from '../../../../src/screens/jarvisPro/JarvisVideoSlotComponents';
import { hardwareService } from '../../../../src/services/hardware';
import {
  createJarvisPhoneActionsExtension,
} from '../../../../src/services/jarvisPro/jarvisPhoneActionsToolExtension';
import {
  jarvisSttService,
  mapLocaleToAndroidSpeechTag,
} from '../../../../src/services/jarvisPro/jarvisSttService';
import { jarvisTtsService } from '../../../../src/services/jarvisPro/jarvisTtsService';
import { jarvisVideoService } from '../../../../src/services/jarvisPro/jarvisVideoService';
import { completeVideoPacks } from '../../../../src/services/phoneVideoPacks';
import { _clearExtensionsForTesting, getToolExtensions } from '../../../../src/services/tools/extensions';
import { useAppStore } from '../../../../src/stores/appStore';
import { useChatStore } from '../../../../src/stores/chatStore';
import { useJarvisProStore } from '../../../../src/stores/jarvisProStore';
import { useUiModeStore } from '../../../../src/stores/uiModeStore';
import type { Message } from '../../../../src/types';
import { withNavigatorRoutes } from '../../../harness/realNavigation';

jest.unmock('@react-navigation/native');

jest.mock('react-native-vector-icons/Feather', () => {
  const { Text } = require('react-native');
  return ({ name, ...props }: any) => <Text {...props}>{name}</Text>;
});

jest.mock('react-native-video-player', () => {
  const { View } = require('react-native');
  return (props: any) => <View testID="mock-video-player" {...props} />;
});

jest.mock('react-native-video', () => ({
  ResizeMode: { CONTAIN: 'contain' },
}));

jest.mock('@react-native-documents/viewer', () => ({
  viewDocument: jest.fn(async () => undefined),
}));

describe('Jarvis Slice 20: Native STT, Voice Mode, Video Slots & Phone Actions', () => {
  const originalPlatformOs = Platform.OS;
  const originalPermCheck = PermissionsAndroid.check;
  const originalPermRequest = PermissionsAndroid.request;

  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as { OS: string }).OS = 'android';
    _clearSlotsForTesting();
    _clearScreensForTesting();
    _clearExtensionsForTesting();
    jarvisTtsService.resetStreamingSpeech();
    useUiModeStore.setState({ interfaceMode: 'chat', voiceSummary: null });
    useChatStore.setState({ conversations: [], activeConversationId: null });
    useAppStore.setState({ generatedImages: [], generatedVideos: [] });
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

    PermissionsAndroid.check = (async () => true) as typeof PermissionsAndroid.check;
    PermissionsAndroid.request = (async () => PermissionsAndroid.RESULTS.GRANTED) as typeof PermissionsAndroid.request;

    NativeModules.JarvisAndroidSttModule = {
      isAvailable: jest.fn(async () => true),
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
      getVoices: jest.fn(async () => [
        { id: 'ru-ru-x-ruf-local', name: 'Русский', locale: 'ru-RU', networkRequired: false },
      ]),
    };
    NativeModules.JarvisPhoneActionsModule = {
      setTimer: jest.fn(async () => ({ ok: true, seconds: 60 })),
      setAlarm: jest.fn(async () => ({ ok: true, hour: 7, minute: 30 })),
      setFlashlight: jest.fn(async () => ({ ok: true, enabled: true })),
      openSystemSettings: jest.fn(async () => ({ ok: true, section: 'wifi' })),
      openUrl: jest.fn(async () => ({ ok: true, url: 'https://example.com' })),
      shareText: jest.fn(async () => ({ ok: true })),
    };
    NativeModules.VideoGenerationModule = {
      generate: jest.fn(async ({ outputPath }: { outputPath: string }) => ({ path: outputPath })),
      cancel: jest.fn(async () => undefined),
    };
  });

  afterEach(async () => {
    await jarvisSttService.cancel();
    jarvisTtsService.resetStreamingSpeech();
    jest.restoreAllMocks();
    (Platform as { OS: string }).OS = originalPlatformOs;
    PermissionsAndroid.check = originalPermCheck;
    PermissionsAndroid.request = originalPermRequest;
    (DeviceInfo.getTotalMemory as jest.Mock).mockResolvedValue(8 * 1024 * 1024 * 1024);
    await hardwareService.refreshMemoryInfo();
    useUiModeStore.setState({ interfaceMode: 'chat', voiceSummary: null });
    useChatStore.setState({ conversations: [], activeConversationId: null });
    useAppStore.setState({ generatedImages: [], generatedVideos: [] });
    delete NativeModules.JarvisAndroidSttModule;
    delete NativeModules.JarvisAndroidTtsModule;
    delete NativeModules.JarvisPhoneActionsModule;
    delete NativeModules.VideoGenerationModule;
  });

  it('maps speech locales accurately and drives native Android STT lifecycle', async () => {
    expect(mapLocaleToAndroidSpeechTag('auto')).toBe('ru-RU');
    expect(mapLocaleToAndroidSpeechTag('ru')).toBe('ru-RU');
    expect(mapLocaleToAndroidSpeechTag('en')).toBe('en-US');
    expect(mapLocaleToAndroidSpeechTag('de_DE')).toBe('de-DE');

    expect(jarvisSttService.isNativeModulePresent()).toBe(true);
    expect(await jarvisSttService.isAvailable()).toBe(true);

    const onPartial = jest.fn();
    const onResult = jest.fn();
    const onError = jest.fn();
    const onEnd = jest.fn();

    const started = await jarvisSttService.startListening({
      language: 'ru',
      preferOffline: true,
      onPartial,
      onResult,
      onError,
      onEnd,
    });
    expect(started).toBe(true);
    expect(NativeModules.JarvisAndroidSttModule.startListening).toHaveBeenCalledWith('ru-RU', true);

    DeviceEventEmitter.emit('JarvisSttPartial', { text: 'Поставь' });
    expect(onPartial).toHaveBeenCalledWith('Поставь');

    // `processing` state (onEndOfSpeech) must NOT prematurely close listeners before onResults arrives.
    DeviceEventEmitter.emit('JarvisSttState', { state: 'processing' });
    expect(onEnd).not.toHaveBeenCalled();

    DeviceEventEmitter.emit('JarvisSttResult', { text: 'Поставь таймер на 5 минут' });
    expect(onResult).toHaveBeenCalledWith('Поставь таймер на 5 минут');
    expect(onEnd).toHaveBeenCalledTimes(1);

    await jarvisSttService.stopListening();
    expect(NativeModules.JarvisAndroidSttModule.stopListening).toHaveBeenCalled();
  });

  it('fails closed when native STT module is missing or microphone permission is denied', async () => {
    const onError = jest.fn();
    const onEnd = jest.fn();

    PermissionsAndroid.check = (async () => false) as typeof PermissionsAndroid.check;
    PermissionsAndroid.request = (async () => PermissionsAndroid.RESULTS.DENIED) as typeof PermissionsAndroid.request;
    const deniedStart = await jarvisSttService.startListening({ onError, onEnd });
    expect(deniedStart).toBe(false);
    expect(onError).toHaveBeenCalledWith('Нет разрешения на микрофон.');
    expect(onEnd).toHaveBeenCalledTimes(1);

    delete NativeModules.JarvisAndroidSttModule;
    expect(jarvisSttService.isNativeModulePresent()).toBe(false);
    expect(await jarvisSttService.isAvailable()).toBe(false);
    const missingStart = await jarvisSttService.startListening({ onError, onEnd });
    expect(missingStart).toBe(false);
  });

  it('queues streaming TTS sentence-by-sentence in Audio Mode and speaks tail after <think>', async () => {
    useUiModeStore.getState().setInterfaceMode('audio');
    const firstSentence = 'Привет, я твой помощник. ';
    jarvisTtsService.onStreamingToken(`${firstSentence}Продолжаю`);

    await waitFor(() =>
      expect(NativeModules.JarvisAndroidTtsModule.speakQueued).toHaveBeenCalledWith(
        'Привет, я твой помощник.',
        'ru-RU',
        1.0,
        null,
      ),
    );

    useChatStore.setState({
      conversations: [
        {
          id: 'conv-stream',
          title: 'Voice',
          modelId: 'm1',
          createdAt: '',
          updatedAt: '',
          messages: [
            {
              id: 'a1',
              role: 'assistant',
              content: `<think>скрытое рассуждение</think>${firstSentence}Продолжаю объяснять ответ.`,
              timestamp: 1,
            },
          ],
        },
      ],
    });
    jarvisTtsService.speakOnStreamEnd('conv-stream');
    await waitFor(() =>
      expect(NativeModules.JarvisAndroidTtsModule.speakQueued).toHaveBeenLastCalledWith(
        'Продолжаю объяснять ответ.',
        'ru-RU',
        1.0,
        null,
      ),
    );
  });

  it('forwards last generated image as initImage in jarvisVideoService.finishDeferred', async () => {
    const pack = completeVideoPacks()[0];
    const existsSpy = jest.spyOn(RNFS, 'exists').mockImplementation(async (p: string) => {
      if (p.endsWith('/video-models')) return true;
      return p.includes(encodeURIComponent(pack.id));
    });
    const readDirSpy = jest.spyOn(RNFS, 'readDir').mockResolvedValue(
      pack.files.map(f => ({
        name: f.name,
        path: `/tmp/${f.name}`,
        size: 1024,
        isFile: () => true,
        isDirectory: () => false,
      })) as any,
    );
    jest.spyOn(RNFS, 'mkdir').mockResolvedValue(undefined as any);
    (DeviceInfo.getTotalMemory as jest.Mock).mockResolvedValue(12 * 1024 * 1024 * 1024);
    await hardwareService.refreshMemoryInfo();
    await jarvisVideoService.scanDownloadedVideoPacks();

    useChatStore.setState({
      conversations: [
        { id: 'conv-i2v', title: 'I2V', modelId: 'm1', createdAt: '', updatedAt: '', messages: [] },
      ],
    });
    useAppStore.setState({
      generatedImages: [
        {
          id: 'img-1',
          prompt: 'кот',
          imagePath: '/data/user/0/app/files/cat.png',
          width: 512,
          height: 512,
          steps: 12,
          seed: 42,
          modelId: 'sd15',
          createdAt: '2026-11-25T00:00:00.000Z',
          conversationId: 'conv-i2v',
        },
      ],
    });

    jarvisVideoService.defer('conv-i2v', {
      prompt: 'кот поворачивает голову',
      startImage: 'last_image',
    });
    await jarvisVideoService.finishDeferred('conv-i2v', false);

    expect(NativeModules.VideoGenerationModule.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        initImage: '/data/user/0/app/files/cat.png',
      }),
    );

    existsSpy.mockRestore();
    readDirSpy.mockRestore();
  });

  it('executes allowlisted Android phone action tools and rejects unsafe inputs fail-closed', async () => {
    const ext = createJarvisPhoneActionsExtension();
    expect(ext.id).toBe('jarvis-phone-actions');
    expect(ext.enabledToolCount()).toBe(6);
    expect(ext.getSystemPromptHint?.()).toContain('set_timer');
    expect(ext.getOpenAISchemas?.()).toHaveLength(6);
    expect(ext.canHandle('open_settings')).toBe(true);
    expect(ext.canHandle('delete_all_files')).toBe(false);

    const timerOk = await ext.execute({ id: 't1', name: 'set_timer', arguments: { seconds: 90, label: 'Чай' } });
    expect(timerOk.error).toBeUndefined();
    expect(NativeModules.JarvisPhoneActionsModule.setTimer).toHaveBeenCalledWith(90, 'Чай');

    const alarmOk = await ext.execute({ id: 't2', name: 'set_alarm', arguments: { hour: 7, minute: 5 } });
    expect(alarmOk.content).toContain('07:05');

    const torchOk = await ext.execute({ id: 't3', name: 'toggle_flashlight', arguments: { enabled: true } });
    expect(torchOk.content).toContain('включён');

    const settingsOk = await ext.execute({ id: 't4', name: 'open_settings', arguments: { section: 'WiFi' } });
    expect(NativeModules.JarvisPhoneActionsModule.openSystemSettings).toHaveBeenCalledWith('wifi');
    expect(settingsOk.error).toBeUndefined();

    const urlOk = await ext.execute({ id: 't5', name: 'open_url', arguments: { url: 'https://github.com' } });
    expect(NativeModules.JarvisPhoneActionsModule.openUrl).toHaveBeenCalledWith('https://github.com');
    expect(urlOk.error).toBeUndefined();

    const shareOk = await ext.execute({ id: 't6', name: 'share_text', arguments: { text: 'Привет!', title: 'Заголовок' } });
    expect(NativeModules.JarvisPhoneActionsModule.shareText).toHaveBeenCalledWith('Привет!', 'Заголовок');
    expect(shareOk.error).toBeUndefined();

    const badTimer = await ext.execute({ id: 'e1', name: 'set_timer', arguments: { seconds: 0 } });
    const badAlarm = await ext.execute({ id: 'e2', name: 'set_alarm', arguments: { hour: 25, minute: 0 } });
    const badTorch = await ext.execute({ id: 'e3', name: 'toggle_flashlight', arguments: { enabled: 'yes' } });
    const badSettings = await ext.execute({ id: 'e4', name: 'open_settings', arguments: { section: 'developer' } });
    const badUrl = await ext.execute({ id: 'e5', name: 'open_url', arguments: { url: 'file:///etc/passwd' } });
    const badShare = await ext.execute({ id: 'e6', name: 'share_text', arguments: { text: '   ' } });
    const unknown = await ext.execute({ id: 'e7', name: 'unknown_cmd', arguments: {} });
    expect(badTimer.error).toBeTruthy();
    expect(badAlarm.error).toBeTruthy();
    expect(badTorch.error).toBeTruthy();
    expect(badSettings.error).toBeTruthy();
    expect(badUrl.error).toBeTruthy();
    expect(badShare.error).toBeTruthy();
    expect(unknown.error).toBeTruthy();

    delete NativeModules.JarvisPhoneActionsModule;
    expect(ext.canHandle('set_timer')).toBe(false);
    expect(ext.enabledToolCount()).toBe(0);
    const missingMod = await ext.execute({ id: 'e8', name: 'set_timer', arguments: { seconds: 30 } });
    expect(missingMod.error).toBeTruthy();
  });

  it('renders all Voice Mode and Video Slot components and registers all 16 slots', async () => {
    activateJarvisOpenCapabilities();

    const allSlots = [
      SLOTS.messageSpeakButton,
      SLOTS.chatInputModeToggle,
      SLOTS.quickSettingsAudioRow,
      SLOTS.chatEmptyAudio,
      SLOTS.chatInputAudioMode,
      SLOTS.messageAudioMode,
      SLOTS.generationSettingsTts,
      SLOTS.generationSettingsTtsSummary,
      SLOTS.generationSettingsVideo,
      SLOTS.modelsScreenVoiceTab,
      SLOTS.modelsScreenVideoTab,
      SLOTS.modelSelectorVideoTab,
      SLOTS.videoStatus,
      SLOTS.imageAnimateAction,
      SLOTS.messageVideoActions,
      SLOTS.galleryVideoSection,
    ];
    for (const slot of allSlots) {
      expect(getSlot(slot)).toBeTruthy();
    }
    expect(hasHook(HOOKS.audioOnStreamingToken)).toBe(true);
    expect(hasHook(HOOKS.audioAugmentPrompt)).toBe(true);
    expect(hasHook(HOOKS.audioOnAppBackground)).toBe(true);
    expect(hasHook(HOOKS.audioOnStreamingEnd)).toBe(true);
    expect(useUiModeStore.getState().voiceSummary).toBe('Jarvis TTS · RU');
    expect(getToolExtensions().some(e => e.id === 'jarvis-phone-actions')).toBe(true);
    expect(getRegisteredScreens().length).toBeGreaterThanOrEqual(1);

    const modeUi = render(<JarvisChatModeToggle />);
    fireEvent.press(modeUi.getByTestId('jarvis-voice-mode-toggle'));
    expect(useUiModeStore.getState().interfaceMode).toBe('audio');
    expect(callHook<string>(HOOKS.audioAugmentPrompt, 'Базовый промпт')).toContain('Режим голосового диалога');

    const closeMock = jest.fn();
    const rowUi = render(<JarvisQuickSettingsAudioRow styles={{}} onClose={closeMock} />);
    expect(rowUi.getByText('ВКЛ')).toBeTruthy();
    fireEvent.press(rowUi.getByTestId('jarvis-quick-voice-mode'));
    expect(useUiModeStore.getState().interfaceMode).toBe('chat');
    expect(closeMock).toHaveBeenCalled();

    const heroUi = render(<JarvisAudioEmptyHero />);
    expect(heroUi.getByText('Голосовой режим Jarvis Ai')).toBeTruthy();
    expect(heroUi.getByText('Jarvis TTS · RU')).toBeTruthy();

    const onStart = jest.fn();
    const onStopRec = jest.fn();
    const onCancelRec = jest.fn();
    const onStopGen = jest.fn();
    const composerUi = render(
      <JarvisAudioComposer
        isRecording={false}
        isGenerating={false}
        voiceAvailable
        onStartRecording={onStart}
        onStopRecording={onStopRec}
        onCancelRecording={onCancelRec}
        onStop={onStopGen}
        imageMode="auto"
        imageModelLoaded={false}
        supportsThinking
        supportsToolCalling
        enabledToolCount={1}
        onImageModeToggle={jest.fn()}
        quickSettings={{
          visible: false,
          anchor: { x: 0, y: 0 },
          triggerRef: React.createRef<React.ElementRef<typeof TouchableOpacity>>(),
          show: jest.fn(),
          hide: jest.fn(),
        }}
        alertState={hideAlert()}
        setAlertState={jest.fn()}
      />,
    );
    fireEvent.press(composerUi.getByTestId('jarvis-audio-mic-button'));
    expect(onStart).toHaveBeenCalled();

    composerUi.rerender(
      <JarvisAudioComposer
        isRecording
        isGenerating={false}
        voiceAvailable
        onStartRecording={onStart}
        onStopRecording={onStopRec}
        onCancelRecording={onCancelRec}
        onStop={onStopGen}
        imageMode="auto"
        imageModelLoaded={false}
        supportsThinking
        supportsToolCalling
        enabledToolCount={1}
        onImageModeToggle={jest.fn()}
        quickSettings={{
          visible: false,
          anchor: { x: 0, y: 0 },
          triggerRef: React.createRef<React.ElementRef<typeof TouchableOpacity>>(),
          show: jest.fn(),
          hide: jest.fn(),
        }}
        alertState={hideAlert()}
        setAlertState={jest.fn()}
      />,
    );
    fireEvent.press(composerUi.getByTestId('jarvis-audio-cancel'));
    expect(onCancelRec).toHaveBeenCalled();

    const assistantMsg: Message = {
      id: 'm-audio',
      role: 'assistant',
      content: 'Готовый голосовой ответ',
      timestamp: 100,
    };
    const msgUi = render(<JarvisAudioMessage msg={assistantMsg} onCopy={jest.fn()} onRetry={jest.fn()} />);
    expect(msgUi.getByText('Jarvis Ai')).toBeTruthy();
    expect(msgUi.getByTestId('jarvis-speak-button')).toBeTruthy();

    const statusUi = render(<JarvisVideoStatusBanner />);
    expect(statusUi.queryByTestId('jarvis-video-status-banner')).toBeNull();
    useJarvisProStore.getState().setVideoRunState({
      videoGenerating: true,
      videoStage: 'generating',
      videoStep: 4,
      videoTotalSteps: 10,
    });
    await waitFor(() => expect(statusUi.getByTestId('jarvis-video-status-banner')).toBeTruthy());
    fireEvent.press(statusUi.getByTestId('jarvis-video-status-cancel'));
    expect(NativeModules.VideoGenerationModule.cancel).toHaveBeenCalled();

    const animateUi = render(
      withNavigatorRoutes(<JarvisAnimateImageAction imagePath="/tmp/photo.png" />, {
        destinations: ['Main'],
      }),
    );
    fireEvent.press(animateUi.getByTestId('jarvis-animate-image-action'));
    await waitFor(() => expect(animateUi.getByTestId('route-Main')).toBeTruthy());

    const videoMsg: Message = {
      id: 'm-vid',
      role: 'assistant',
      content: 'Видео сгенерировано: Закат над океаном',
      timestamp: 200,
      attachments: [
        { id: 'att-1', type: 'video', uri: 'file:///tmp/out.mp4', mimeType: 'video/mp4' },
      ],
    };
    const videoCardUi = render(
      withNavigatorRoutes(<JarvisVideoMessageCard message={videoMsg} />, {
        destinations: ['Gallery'],
      }),
    );
    expect(videoCardUi.getByTestId('jarvis-video-message-card')).toBeTruthy();
    fireEvent.press(videoCardUi.getByTestId('jarvis-video-message-gallery'));
    await waitFor(() => expect(videoCardUi.getByTestId('route-Gallery')).toBeTruthy());

    useJarvisProStore.getState().setVideoRunState({ videoGenerating: false });
    const galleryUi = render(
      withNavigatorRoutes(<JarvisGalleryVideoSection />, {
        destinations: ['Main'],
      }),
    );
    fireEvent.press(galleryUi.getByTestId('jarvis-gallery-video-create'));
    expect(galleryUi.getByText('Введите описание видео.')).toBeTruthy();
    fireEvent.changeText(galleryUi.getByTestId('jarvis-gallery-video-input'), 'Волны моря');
    fireEvent.press(galleryUi.getByTestId('jarvis-gallery-video-create'));
    await waitFor(() => expect(galleryUi.getByTestId('route-Main')).toBeTruthy());
  });
});
