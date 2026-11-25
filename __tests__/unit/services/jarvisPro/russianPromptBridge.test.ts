import { Platform } from 'react-native';
import {
  hasCyrillic,
  stripRussianMediaCommand,
  translateRussianVisualPromptFallback,
  prepareMediaPromptForEngine,
} from '../../../../src/services/jarvisPro/russianPromptBridge';
import {
  createJarvisImageToolExtension,
  finishDeferredJarvisImage,
  discardDeferredJarvisImage,
  hasPendingJarvisImage,
} from '../../../../src/services/jarvisPro/jarvisImageToolExtension';
import { intentClassifier, classifyToolsNeeded } from '../../../../src/services/intentClassifier';
import { isVideoRequest } from '../../../../src/utils/videoIntent';
import {
  JARVIS_RU_SYSTEM_PROMPT,
  firstPrompt,
  isBuiltInPrompt,
  resolveSystemPrompt,
} from '../../../../src/utils/systemPrompt';
import { activateJarvisOpenCapabilities } from '../../../../src/bootstrap/activateJarvisOpenCapabilities';
import { HOOKS, callHook, hasHook } from '../../../../src/bootstrap/hookRegistry';
import {
  _clearExtensionsForTesting,
  getToolExtensions,
} from '../../../../src/services/tools/extensions';
import { APP_CONFIG } from '../../../../src/constants';
import { _clearScreensForTesting } from '../../../../src/navigation/screenRegistry';
import { useAppStore } from '../../../../src/stores/appStore';
import { useRemoteServerStore } from '../../../../src/stores/remoteServerStore';

describe('Jarvis Russian Prompt Bridge, Classifiers & Image Tool Extension', () => {
  const originalPlatformOs = Platform.OS;

  beforeEach(() => {
    intentClassifier.clearCache();
    _clearExtensionsForTesting();
    _clearScreensForTesting();
    discardDeferredJarvisImage('conv-ru-img');
    (Platform as { OS: string }).OS = 'android';
    useAppStore.setState({
      downloadedImageModels: [],
      activeImageModelId: null,
    });
    useRemoteServerStore.setState({
      servers: [],
      activeServerId: null,
      activeRemoteMediaServerIds: {},
    });
  });

  afterEach(() => {
    _clearExtensionsForTesting();
    _clearScreensForTesting();
    discardDeferredJarvisImage('conv-ru-img');
    (Platform as { OS: string }).OS = originalPlatformOs;
    useAppStore.setState({
      downloadedImageModels: [],
      activeImageModelId: null,
    });
    useRemoteServerStore.setState({
      servers: [],
      activeServerId: null,
      activeRemoteMediaServerIds: {},
    });
  });

  it('translates Russian drawing commands to clean ASCII English prompts', () => {
    expect(hasCyrillic('киберпанк')).toBe(true);
    expect(hasCyrillic('cyberpunk cat')).toBe(false);

    expect(
      stripRussianMediaCommand('Нарисуй пожалуйста красивую картинку с котом в стиле киберпанк'),
    ).toBe('котом в стиле киберпанк');

    const catPrompt = translateRussianVisualPromptFallback(
      'Нарисуй кота в стиле киберпанк, ночной город, 8к',
    );
    expect(hasCyrillic(catPrompt)).toBe(false);
    expect(catPrompt).toMatch(/cat/i);
    expect(catPrompt).toMatch(/cyberpunk style/i);
    expect(catPrompt).toMatch(/night city/i);
    expect(catPrompt).toMatch(/8k/i);

    const prepared = prepareMediaPromptForEngine('Сделай фото заката над морем');
    expect(hasCyrillic(prepared)).toBe(false);
    expect(prepared).toMatch(/sunset over the sea/i);

    expect(prepareMediaPromptForEngine('Нарисуй лису', 'red fox in snow')).toBe('red fox in snow');
    const cyrillicLlmOutput = prepareMediaPromptForEngine('Нарисуй лису', 'лиса на снегу');
    expect(hasCyrillic(cyrillicLlmOutput)).toBe(false);
    expect(cyrillicLlmOutput).toMatch(/fox/i);

    expect(stripRussianMediaCommand('')).toBe('');
    expect(stripRussianMediaCommand('Нарисуй кота')).toBe('кота');
    expect(stripRussianMediaCommand('рыжий кот на диване')).toBe('рыжий кот на диване');
    expect(stripRussianMediaCommand('пожалуйста')).toBe('пожалуйста');
    expect(translateRussianVisualPromptFallback('')).toBe('');

    const complexVisual = translateRussianVisualPromptFallback(
      'щука рядом с юлой, ёжик в тумане и эльф, 4к 3д, ultra hd',
    );
    expect(hasCyrillic(complexVisual)).toBe(false);
    expect(complexVisual).toMatch(/4k/i);
    expect(complexVisual).toMatch(/3d/i);
    expect(complexVisual).toMatch(/ultra hd/i);
    expect(complexVisual).toMatch(/beside/i);

    expect(prepareMediaPromptForEngine('   ')).toBe('');
    expect(prepareMediaPromptForEngine('neon dragon')).toBe('neon dragon');
    const blankLlmFallback = prepareMediaPromptForEngine('нарисуй дракона', '   ');
    expect(hasCyrillic(blankLlmFallback)).toBe(false);
    expect(blankLlmFallback).toMatch(/dragon/i);
  });

  it('classifies Russian and English drawing requests while sparing informational questions', async () => {
    const positives = [
      'нарисуй кота в стиле киберпанк',
      'сгенерируй картинку горного заката',
      'сделай мне фото космонавта',
      'draw a neon castle',
    ];
    for (const msg of positives) {
      expect(await intentClassifier.classifyIntent(msg, { useLLM: false })).toBe('image');
    }

    const negatives = [
      'как нарисовать кота пошагово',
      'что такое Stable Diffusion',
      'объясни почему небо синее',
      'explain how artists draw realistic portraits',
    ];
    for (const msg of negatives) {
      expect(await intentClassifier.classifyIntent(msg, { useLLM: false })).toBe('text');
    }

    // Repeat call exercises cache hit; short (< 10 chars) and multi-sentence (> 100 chars) exercise fallback branches
    expect(await intentClassifier.classifyIntent('нарисуй кота в стиле киберпанк', { useLLM: false })).toBe('image');
    expect(await intentClassifier.classifyIntent('привет', { useLLM: false })).toBe('text');
    expect(
      await intentClassifier.classifyIntent(
        'Первый абзац описания обычной темы для теста длины строки. Второй абзац тоже длинный и содержит достаточное число символов!',
        { useLLM: false },
      ),
    ).toBe('text');
  });

  it('detects Russian tool keywords cleanly without ASCII word-boundary bugs', () => {
    expect(classifyToolsNeeded('Поищи курс доллара на сегодня')).toEqual(
      expect.arrayContaining(['web_search', 'read_url']),
    );
    expect(classifyToolsNeeded('Открой и перескажи статью по ссылке')).toEqual(
      expect.arrayContaining(['read_url', 'web_search']),
    );
    expect(classifyToolsNeeded('Посчитай процент от числа 4500')).toContain('calculator');
    expect(classifyToolsNeeded('Который час и какое сегодня число?')).toContain(
      'get_current_datetime',
    );
    expect(classifyToolsNeeded('Сколько памяти и заряд батареи на телефоне?')).toContain(
      'get_device_info',
    );
  });

  it('recognizes Russian video generation prompts and rejects non-generation questions', () => {
    expect(isVideoRequest('')).toBe(false);
    expect(isVideoRequest('   ')).toBe(false);
    expect(isVideoRequest('Сделай видео заката над морем')).toBe(true);
    expect(isVideoRequest('Оживи фото кота')).toBe(true);
    expect(isVideoRequest('Сгенерируй короткий ролик про горы')).toBe(true);
    expect(isVideoRequest('Animate a rocket launching')).toBe(true);
    expect(isVideoRequest('a video of waves')).toBe(true);
    expect(isVideoRequest('Как сделать видео на телефоне?')).toBe(false);
    expect(isVideoRequest('Перескажи это видео')).toBe(false);
  });

  it('treats JARVIS_RU_SYSTEM_PROMPT and legacy Off Grid prompt cleanly as built-in prompts', () => {
    expect(JARVIS_RU_SYSTEM_PROMPT).toContain('Jarvis Ai');
    expect(isBuiltInPrompt(JARVIS_RU_SYSTEM_PROMPT)).toBe(true);
    expect(isBuiltInPrompt(APP_CONFIG.defaultSystemPrompt)).toBe(true);
    expect(isBuiltInPrompt(undefined)).toBe(true);
    expect(firstPrompt('  ', 'Свой системный промпт')).toBe('Свой системный промпт');
    expect(resolveSystemPrompt('Свой системный промпт')).toBe('Свой системный промпт');
    expect(resolveSystemPrompt('', undefined)).toBe(APP_CONFIG.defaultSystemPrompt);
  });

  it('exposes generate_image only when image model exists and manages deferred queue cleanly', async () => {
    const ext = createJarvisImageToolExtension();
    expect(ext.id).toBe('jarvis-open-image');
    expect(ext.getSystemPromptHint()).toBe('');
    expect(ext.getOpenAISchemas?.() ?? []).toEqual([]);
    expect(ext.canHandle('generate_image')).toBe(false);
    expect(ext.canHandle('other_tool')).toBe(false);
    expect(ext.enabledToolCount?.()).toBe(0);
    expect(ext.parseToolCalls?.('x')).toEqual([]);
    expect(ext.stripFromVisibleText?.('x')).toBe('x');

    const invalidArgsResult = await ext.execute({
      id: 'call-empty',
      name: 'generate_image',
      arguments: { prompt: '' },
      context: {},
    });
    expect(invalidArgsResult.error).toContain('Требуется описание');

    const noModelResult = await ext.execute({
      id: 'call-0',
      name: 'generate_image',
      arguments: { prompt: 'cyberpunk cat' },
      context: { conversationId: 'conv-ru-img' },
    });
    expect(noModelResult.error).toContain('Не скачана модель');

    const listener = jest.fn();
    const unsubscribe = ext.subscribe?.(listener);

    useRemoteServerStore.setState({
      servers: [
        {
          id: 'srv-img',
          name: 'Local GPU',
          endpoint: 'http://127.0.0.1:8080',
          providerType: 'openai-compatible',
          createdAt: '2026-11-25T00:00:00.000Z',
          mediaModels: { image: 'sdxl' },
        },
      ],
      activeRemoteMediaServerIds: { image: 'srv-img' },
    });
    expect(ext.canHandle('generate_image')).toBe(true);
    expect(ext.enabledToolCount?.()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);

    useAppStore.setState({
      downloadedImageModels: [
        {
          id: 'sd-ru-test',
          name: 'SD Test',
          description: 'Local SD',
          modelPath: '/tmp/sd-test',
          downloadedAt: '2026-11-25T00:00:00.000Z',
          size: 1024,
          backend: 'mnn',
        },
      ],
    });
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe?.();

    expect(ext.canHandle('generate_image')).toBe(true);
    expect(ext.enabledToolCount?.()).toBe(1);
    expect((ext.getOpenAISchemas?.() ?? []).map(s => s.function.name)).toEqual(['generate_image']);
    expect(ext.getSystemPromptHint()).toContain('generate_image');

    const queuedResult = await ext.execute({
      id: 'call-1',
      name: 'generate_image',
      arguments: { prompt: 'нарисуй кота в лесу', negative_prompt: 'blurry' },
      context: { conversationId: 'conv-ru-img' },
    });
    expect(queuedResult.error).toBeUndefined();
    expect(hasPendingJarvisImage()).toBe(true);

    discardDeferredJarvisImage('conv-ru-img');
    expect(hasPendingJarvisImage()).toBe(false);

    // Non-existent conversation finishes cleanly as a no-op
    await finishDeferredJarvisImage('unknown-id', false);

    // Queue again and test stopped turn cleanup
    await ext.execute({
      id: 'call-2',
      name: 'generate_image',
      arguments: { prompt: 'нарисуй дракона' },
      context: { conversationId: 'conv-ru-img' },
    });
    await finishDeferredJarvisImage('conv-ru-img', true);
    expect(hasPendingJarvisImage()).toBe(false);

    // Activate wires extension & chained deferred hooks cleanly
    activateJarvisOpenCapabilities();
    expect(getToolExtensions().some(e => e.id === 'jarvis-open-image')).toBe(true);
    expect(hasHook(HOOKS.videoFinishDeferred)).toBe(true);
    expect(hasHook(HOOKS.videoHasPending)).toBe(true);
    expect(await callHook(HOOKS.videoHasPending)).toBe(false);
    await callHook(HOOKS.videoFinishDeferred, 'missing', true);
    await callHook(HOOKS.videoDiscardDeferred, 'missing');
  });
});
