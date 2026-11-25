import { DeviceEventEmitter, NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import { HOOKS, callHook, hasHook } from '../../../../src/bootstrap/hookRegistry';
import { SLOTS, getSlot } from '../../../../src/bootstrap/slotRegistry';
import { activateJarvisOpenCapabilities } from '../../../../src/bootstrap/activateJarvisOpenCapabilities';
import {
  _clearScreensForTesting,
  getRegisteredScreens,
} from '../../../../src/navigation/screenRegistry';
import { PRO_TOOLS_SCREEN } from '../../../../src/hooks/useIsProActive';
import {
  addMcpServer,
  createJarvisMcpToolExtension,
  refreshMcpServerTools,
  validateMcpServerUrl,
} from '../../../../src/services/jarvisPro/jarvisMcpService';
import {
  jarvisTtsService,
  stripMarkdownForSpeech,
} from '../../../../src/services/jarvisPro/jarvisTtsService';
import { jarvisVideoService } from '../../../../src/services/jarvisPro/jarvisVideoService';
import { completeVideoPacks } from '../../../../src/services/phoneVideoPacks';
import {
  _clearExtensionsForTesting,
  getToolExtensions,
} from '../../../../src/services/tools/extensions';
import { hardwareService } from '../../../../src/services/hardware';
import { useAppStore } from '../../../../src/stores/appStore';
import { useChatStore } from '../../../../src/stores/chatStore';
import { useJarvisProStore } from '../../../../src/stores/jarvisProStore';

describe('Jarvis Pro Store and Services', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    _clearScreensForTesting();
    _clearExtensionsForTesting();
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
    NativeModules.JarvisAndroidTtsModule = {
      isAvailable: jest.fn(async () => true),
      speak: jest.fn(async () => true),
      stop: jest.fn(async () => true),
      isSpeaking: jest.fn(async () => false),
      getVoices: jest.fn(async () => [
        { id: 'ru-ru-x-ruf-local', name: 'ru-ru-x-ruf-local', locale: 'ru-RU', networkRequired: false },
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

  it('clamps TTS rate and updates store preferences & MCP servers', () => {
    const store = useJarvisProStore.getState();
    store.setTtsRate(99);
    expect(useJarvisProStore.getState().ttsRate).toBe(2.0);
    store.setTtsRate(0.1);
    expect(useJarvisProStore.getState().ttsRate).toBe(0.5);
    store.setTtsRate(Number.NaN);
    expect(useJarvisProStore.getState().ttsRate).toBe(1.0);
    store.setTtsVoiceId('ru-voice');
    store.setVideoBackend('gpu');
    expect(useJarvisProStore.getState().ttsVoiceId).toBe('ru-voice');
    expect(useJarvisProStore.getState().videoBackend).toBe('gpu');
  });

  it('strips markdown cleanly and drives Android offline Russian TTS including voiceId & auto-speak', async () => {
    expect(stripMarkdownForSpeech('# Заголовок\n**Текст** `code` [ссылка](https://a.b)')).toBe(
      'Заголовок Текст code ссылка',
    );
    expect(await jarvisTtsService.canSpeak()).toBe(true);
    expect(await jarvisTtsService.listVoices()).toHaveLength(1);

    useJarvisProStore.getState().setTtsRate(1.2);
    useJarvisProStore.getState().setTtsVoiceId('ru-ru-x-ruf-local');
    const ok = await jarvisTtsService.speak('**Привет**, мир!', 'msg-1');
    expect(ok).toBe(true);
    expect(NativeModules.JarvisAndroidTtsModule.speak).toHaveBeenCalledWith(
      'Привет, мир!',
      'ru-RU',
      1.2,
      'ru-ru-x-ruf-local',
    );
    expect(jarvisTtsService.isSpeaking()).toBe(true);

    DeviceEventEmitter.emit('JarvisTtsState', { state: 'done' });
    expect(jarvisTtsService.isSpeaking()).toBe(false);

    useJarvisProStore.getState().setTtsAutoSpeak(true);
    useChatStore.setState({
      conversations: [
        {
          id: 'conv-tts',
          title: 'Chat',
          modelId: 'm1',
          createdAt: '',
          updatedAt: '',
          messages: [{ id: 'a1', role: 'assistant', content: 'Готовый ответ', timestamp: 1 }],
        },
      ],
    });
    jarvisTtsService.speakOnStreamEnd('conv-tts');
    expect(NativeModules.JarvisAndroidTtsModule.speak).toHaveBeenCalledTimes(2);

    await jarvisTtsService.stop();
    expect(NativeModules.JarvisAndroidTtsModule.stop).toHaveBeenCalled();
  });

  it('handles missing native TTS gracefully', async () => {
    delete NativeModules.JarvisAndroidTtsModule;
    expect(await jarvisTtsService.canSpeak()).toBe(false);
    expect(await jarvisTtsService.listVoices()).toEqual([]);
    expect(await jarvisTtsService.speak('Привет')).toBe(false);
  });

  it('scans, downloads, deletes, and generates local video packs via VideoGenerationModule', async () => {
    const pack = completeVideoPacks()[0];
    expect(pack).toBeDefined();

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
    jest.spyOn(hardwareService, 'getTotalMemoryGB').mockReturnValue(12);

    const scanned = await jarvisVideoService.scanDownloadedVideoPacks();
    expect(scanned).toContain(pack.id);
    expect(useJarvisProStore.getState().selectedVideoPackId).toBe(pack.id);

    useChatStore.setState({
      conversations: [
        { id: 'conv-vid', title: 'Vid', modelId: 'm', createdAt: '', updatedAt: '', messages: [] },
      ],
    });

    const out = await jarvisVideoService.generateVideo({
      prompt: 'Космический рассвет',
      conversationId: 'conv-vid',
      styleId: 'cinematic',
    });
    expect(out.path).toContain('/generated-videos/jarvis-vid-');
    expect(NativeModules.VideoGenerationModule.generate).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().generatedVideos.some(v => v.prompt === 'Космический рассвет')).toBe(true);

    const downloadSpy = jest.spyOn(RNFS, 'downloadFile').mockReturnValue({
      jobId: 42,
      promise: Promise.resolve({ jobId: 42, statusCode: 200, bytesWritten: 100 }),
    } as any);
    const statSpy = jest.spyOn(RNFS, 'stat').mockResolvedValue({ size: 0 } as any);
    await jarvisVideoService.downloadVideoPack(pack);
    expect(downloadSpy).toHaveBeenCalled();
    expect(useJarvisProStore.getState().videoDownloadingPackId).toBeNull();
    jarvisVideoService.cancelVideoDownload();
    statSpy.mockRestore();

    const unlinkSpy = jest.spyOn(RNFS, 'unlink').mockResolvedValue(undefined as any);
    await jarvisVideoService.deleteVideoPack(pack.id);
    expect(unlinkSpy).toHaveBeenCalled();

    jarvisVideoService.defer('conv-def', { prompt: 'Test' });
    expect(jarvisVideoService.hasPending()).toBe(true);
    await jarvisVideoService.finishDeferred('conv-def', true);
    expect(jarvisVideoService.hasPending()).toBe(false);
    await jarvisVideoService.cancel();

    existsSpy.mockRestore();
    readDirSpy.mockRestore();
    unlinkSpy.mockRestore();
  });

  it('validates MCP URLs, discovers HTTP JSON-RPC tools, and executes fail-closed extension calls', async () => {
    expect(() => validateMcpServerUrl('ftp://bad.host')).toThrow();
    expect(() => validateMcpServerUrl('not-a-url')).toThrow();
    expect(validateMcpServerUrl(' https://mcp.local/rpc ')).toBe('https://mcp.local/rpc');

    global.fetch = jest.fn(async (_url, init: any) => {
      const body = JSON.parse(init.body);
      if (body.method === 'tools/list') {
        return {
          ok: true,
          json: async () => ({
            result: {
              tools: [{ name: 'weather', description: 'Погода', inputSchema: { type: 'object' } }],
            },
          }),
        } as any;
      }
      if (body.method === 'tools/call') {
        return {
          ok: true,
          json: async () => ({
            result: { content: [{ text: 'Ясно +22C' }] },
          }),
        } as any;
      }
      return { ok: false, status: 500, json: async () => ({}) } as any;
    }) as any;

    const added = await addMcpServer('Local MCP', 'https://mcp.local/rpc');
    expect(added.tools).toHaveLength(1);
    expect(added.lastError).toBeNull();

    const ext = createJarvisMcpToolExtension();
    expect(ext.enabledToolCount()).toBe(1);
    const fullName = ext.getOpenAISchemas?.()[0]?.function.name!;
    expect(ext.canHandle(fullName)).toBe(true);

    const res = await ext.execute({ id: 'c1', name: fullName, arguments: { city: 'Moscow' } });
    expect(res.content).toBe('Ясно +22C');
    expect(res.error).toBeUndefined();

    useJarvisProStore.getState().toggleMcpToolEnabled(added.id, 'weather', false);
    expect(ext.enabledToolCount()).toBe(0);
    const blocked = await ext.execute({ id: 'c2', name: fullName, arguments: {} });
    expect(blocked.error).toBeTruthy();

    global.fetch = jest.fn(async () => ({ ok: false, status: 502 })) as any;
    await expect(refreshMcpServerTools(added.id)).rejects.toThrow('HTTP 502');
  });

  it('activates all hooks, UI slots, McpServers screen, and MCP extension cleanly', () => {
    activateJarvisOpenCapabilities();

    expect(hasHook(HOOKS.audioCanSpeak)).toBe(true);
    expect(hasHook(HOOKS.audioSpeak)).toBe(true);
    expect(hasHook(HOOKS.videoGenerate)).toBe(true);
    expect(getSlot(SLOTS.messageSpeakButton)).toBeTruthy();
    expect(getSlot(SLOTS.generationSettingsTts)).toBeTruthy();
    expect(getSlot(SLOTS.generationSettingsTtsSummary)).toBeTruthy();
    expect(getSlot(SLOTS.generationSettingsVideo)).toBeTruthy();
    expect(getSlot(SLOTS.modelsScreenVoiceTab)).toBeTruthy();
    expect(getSlot(SLOTS.modelsScreenVideoTab)).toBeTruthy();
    expect(getSlot(SLOTS.modelSelectorVideoTab)).toBeTruthy();
    expect(getRegisteredScreens().some(s => s.name === PRO_TOOLS_SCREEN)).toBe(true);
    expect(getToolExtensions().some(e => e.id === 'jarvis-open-mcp')).toBe(true);

    expect(callHook<boolean>(HOOKS.videoIsBusy)).toBe(false);
  });
});
