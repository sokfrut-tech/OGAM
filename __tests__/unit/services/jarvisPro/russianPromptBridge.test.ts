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
import { _clearScreensForTesting } from '../../../../src/navigation/screenRegistry';
import { useAppStore } from '../../../../src/stores/appStore';

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
      activeImageModel: null,
    });
  });

  afterEach(() => {
    discardDeferredJarvisImage('conv-ru-img');
    (Platform as { OS: string }).OS = originalPlatformOs;
    useAppStore.setState({
      downloadedImageModels: [],
      activeImageModel: null,
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
      'how to draw a cat',
    ];
    for (const msg of negatives) {
      expect(await intentClassifier.classifyIntent(msg, { useLLM: false })).toBe('text');
    }
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
    expect(isVideoRequest('Сделай видео заката над морем')).toBe(true);
    expect(isVideoRequest('Оживи фото кота')).toBe(true);
    expect(isVideoRequest('Сгенерируй короткий ролик про горы')).toBe(true);
    expect(isVideoRequest('Как сделать видео на телефоне?')).toBe(false);
    expect(isVideoRequest('Перескажи это видео')).toBe(false);
  });

  it('treats JARVIS_RU_SYSTEM_PROMPT and legacy Off Grid prompt cleanly as built-in prompts', () => {
    expect(JARVIS_RU_SYSTEM_PROMPT).toContain('Jarvis Ai');
    expect(isBuiltInPrompt(JARVIS_RU_SYSTEM_PROMPT)).toBe(true);
    expect(isBuiltInPrompt(undefined)).toBe(true);
    expect(firstPrompt('  ', 'Свой системный промпт')).toBe('Свой системный промпт');
    expect(resolveSystemPrompt('Свой системный промпт')).toBe('Свой системный промпт');
  });

  it('exposes generate_image only when image model exists and manages deferred queue cleanly', async () => {
    const ext = createJarvisImageToolExtension();
    expect(ext.id).toBe('jarvis-open-image');
    expect(ext.getSystemPromptHint()).toBe('');
    expect(ext.getOpenAISchemas()).toEqual([]);
    expect(ext.canHandle('generate_image')).toBe(false);
    expect(ext.enabledToolCount?.()).toBe(0);

    const noModelResult = await ext.execute({
      id: 'call-0',
      name: 'generate_image',
      arguments: { prompt: 'cyberpunk cat' },
      context: { conversationId: 'conv-ru-img' },
    });
    expect(noModelResult.error).toContain('Не скачана модель');

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

    expect(ext.canHandle('generate_image')).toBe(true);
    expect(ext.enabledToolCount?.()).toBe(1);
    expect(ext.getOpenAISchemas().map(s => s.function.name)).toEqual(['generate_image']);
    expect(ext.getSystemPromptHint()).toContain('generate_image');

    const queuedResult = await ext.execute({
      id: 'call-1',
      name: 'generate_image',
      arguments: { prompt: 'нарисуй кота в лесу', negative_prompt: 'blurry' },
      context: { conversationId: 'conv-ru-img' },
    });
    expect(queuedResult.error).toBeUndefined();
    expect(hasPendingJarvisImage()).toBe(true);

    // Stopped turn clears pending request without invoking native SD
    await finishDeferredJarvisImage('conv-ru-img', true);
    expect(hasPendingJarvisImage()).toBe(false);

    // Activate wires extension & chained deferred hooks cleanly
    const cleanup = activateJarvisOpenCapabilities();
    expect(getToolExtensions().some(e => e.id === 'jarvis-open-image')).toBe(true);
    expect(hasHook(HOOKS.videoFinishDeferred)).toBe(true);
    expect(hasHook(HOOKS.videoHasPending)).toBe(true);
    await callHook(HOOKS.videoDiscardDeferred, 'conv-ru-img');
    cleanup();
  });
});
