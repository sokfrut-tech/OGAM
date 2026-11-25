export {
  MODEL_RECOMMENDATIONS,
  RECOMMENDED_MODELS,
  TRENDING_FAMILIES,
  TRENDING_MODEL_IDS,
  MODEL_ORGS,
  QUANTIZATION_INFO,
} from './models';

// External URLs
export const WEDNESDAY_URL = 'https://wednesday.is';

// Off Grid AI Desktop: the free, open-source desktop app (not a Pro feature).
// Linked from Pro screens and from remote-server discovery alike.
export const OFF_GRID_DESKTOP_URL = 'https://getoffgridai.co/desktop';
export const OFF_GRID_DESKTOP_BENEFIT =
  'More power, same privacy. Run bigger models on your Windows, macOS or Linux computer and keep every device in sync.';

export const PRO_AHA_FEATURES = [
  'Create images with the model active on your Desktop',
  'Transcribe speech with the model active on your Desktop',
  'Hear replies in the voice active on your Desktop',
  'Control which models your named Desktop serves',
];

// Hugging Face API configuration
export const HF_API = {
  baseUrl: 'https://huggingface.co',
  apiUrl: 'https://huggingface.co/api',
  modelsEndpoint: '/models',
  searchParams: {
    filter: 'gguf',
    sort: 'downloads',
    direction: '-1',
    limit: 30,
  },
};

// Model credibility configuration
// LM Studio community - highest credibility for GGUF models
export const LMSTUDIO_AUTHORS = ['lmstudio-community', 'lmstudio-ai'];

// Official model creators - these are the original model authors
export const OFFICIAL_MODEL_AUTHORS: Record<string, string> = {
  'meta-llama': 'Meta',
  microsoft: 'Microsoft',
  google: 'Google',
  Qwen: 'Alibaba',
  mistralai: 'Mistral AI',
  HuggingFaceTB: 'Hugging Face',
  HuggingFaceH4: 'Hugging Face',
  bigscience: 'BigScience',
  EleutherAI: 'EleutherAI',
  tiiuae: 'TII UAE',
  stabilityai: 'Stability AI',
  databricks: 'Databricks',
  THUDM: 'Tsinghua University',
  'baichuan-inc': 'Baichuan',
  internlm: 'InternLM',
  '01-ai': '01.AI',
  'deepseek-ai': 'DeepSeek',
  CohereForAI: 'Cohere',
  allenai: 'Allen AI',
  nvidia: 'NVIDIA',
  apple: 'Apple',
  // Makers of the late-October catalog models.
  XHToken: 'iFLYTEK',
  InternScience: 'Shanghai AI Lab',
  RecursiveSI: 'Recursive',
};

// Verified quantizers - trusted community members who quantize models
export const VERIFIED_QUANTIZERS: Record<string, string> = {
  TheBloke: 'TheBloke',
  bartowski: 'bartowski',
  QuantFactory: 'QuantFactory',
  mradermacher: 'mradermacher',
  'second-state': 'Second State',
  MaziyarPanahi: 'Maziyar Panahi',
  Triangle104: 'Triangle104',
  unsloth: 'Unsloth',
  'ggml-org': 'GGML (HuggingFace)',
};

// Credibility level labels
export const CREDIBILITY_LABELS = {
  offgrid: {
    label: 'Off Grid AI',
    description: 'Made by Off Grid AI',
    color: '#34D399', // emerald
  },
  lmstudio: {
    label: 'LM Studio',
    description: 'Official LM Studio quantization - highest quality GGUF',
    color: '#22D3EE', // cyan
  },
  official: {
    label: 'Official',
    description: 'From the original model creator',
    color: '#22C55E', // green
  },
  'verified-quantizer': {
    label: 'Verified',
    description: 'From a trusted quantization provider',
    color: '#A78BFA', // purple
  },
  community: {
    label: 'Community',
    description: 'Community contributed model',
    color: '#64748B', // gray
  },
};

// App configuration
/** Built-in prompts earlier builds stored as the user's own. Read as the current built-in one. */
export const PREVIOUS_DEFAULT_SYSTEM_PROMPTS: readonly string[] = [
  `You are a helpful AI assistant running locally on the user's device. Your responses should be:
- Accurate and factual - never make up information
- Concise but complete - answer the question fully without unnecessary elaboration
- Helpful and friendly - focus on solving the user's actual need
- Honest about limitations - if you don't know something, say so

If asked about yourself, you can mention you're a local AI assistant that prioritizes user privacy.`,
  `You are Off Grid AI, an assistant that runs entirely on this phone. Nothing the user types leaves the device, and you work with no internet connection. You are not in a browser and not on a server.

In this app the user can chat with you, make images, attach documents and photos for you to read, and keep related chats together in projects.

Your answers should be:
- Accurate: never make up information
- Concise but complete: answer the question fully, without padding
- Helpful and friendly: solve the user's actual need
- Honest about limits: if you don't know, say so

If asked about yourself, say you are Off Grid AI, running privately on this phone.`,
  `You are Off Grid AI, an assistant that runs entirely on this phone. Nothing the user types leaves the device, and you work with no internet connection. You are not in a browser and not on a server.

Answer everyday questions straight from what you know: colours, facts, words, maths, ideas. You need nothing else for those, so never say you lack access or a tool for them.

In this app the user can chat with you, make images, attach documents and photos for you to read, and keep related chats together in projects.

Your answers should be:
- Accurate: never make up information
- Concise but complete: answer the question fully, without padding
- Helpful and friendly: focus on solving the user's actual need
- Honest about limits: if you don't know, say so

If asked about yourself, say you are Off Grid AI, running privately on this phone.`,
];

export const APP_CONFIG = {
  modelStorageDir: 'models',
  whisperStorageDir: 'whisper-models',
  maxConcurrentDownloads: 1,
  defaultSystemPrompt: `Ты — Джарвис, русскоязычный ИИ-помощник на этом телефоне. По умолчанию отвечай по-русски. Работай локально, когда выбрана локальная модель; не утверждай, что запрос офлайн, если активна удалённая модель. Не отправляй данные пользователя с устройства без его явного разрешения.

Отвечай точно и по делу. Не выдумывай факты, результаты действий или доступ к функциям телефона. Когда не знаешь ответа, прямо скажи об этом. Перед потенциально опасными действиями проси подтверждение.

Помогай с обычными вопросами, анализом документов и изображений, а также с доступными инструментами приложения. Если спрашивают, кто ты, отвечай: «Я Джарвис AI — помощник на этом телефоне».`,
  streamingEnabled: true,
  maxContextLength: 4096, // Default context window; eliminates double-init on models that support ≥4096
};

export interface OnboardingSlide {
  id: string;
  keyword: string;
  title: string;
  description: string;
}

// Core onboarding slides. Optional feature packages contribute additional slide data through the
// onboarding.additionalSlides hook so Core keeps one renderer without advertising unavailable
// features in free builds.
import { boostPromoCopy } from '../utils/boostPromo';

export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    id: 'freedom',
    keyword: 'ТВОЙ',
    title: 'Твой ИИ.\nТолько для тебя.',
    description:
      'Без подписок и регистрации. Твои диалоги остаются твоими. ИИ работает на устройстве и подчиняется только тебе.',
  },
  {
    id: 'magic',
    keyword: 'ПРОСТО',
    title: 'Говори как обычно.\nОстальное сделает ИИ.',
    description:
      'Опиши изображение — ИИ создаст его. Покажи фотографию — он её поймёт. Прикрепи документ — он прочитает его. Всё в одном диалоге.',
  },
  {
    id: 'create',
    keyword: 'СОЗДАВАЙ',
    title: 'Опиши идею.\nПолучи результат.',
    description:
      'Напиши, например: «кот на Луне», и преврати слова в изображение. ИИ поможет оформить идею — специальные команды не нужны.',
  },
  {
    // The private cloud offer (shared copy): models too big for the phone, on our servers.
    id: 'boost',
    keyword: 'МОЩНЕЕ',
    title: 'Более сильные ответы\nбез нового телефона.',
    description: boostPromoCopy('phone').body,
  },
  {
    id: 'hardware',
    keyword: 'ГОТОВ',
    title: 'Выбирай, как\nработает твой ИИ.',
    description:
      'Запускай модели прямо на телефоне или подключай модели в домашней сети. Подберём подходящий вариант.',
  },
];

// Fonts, type, spacing, radius and the living field come from OGAM-owned designTokens.
import { FONTS, TYPOGRAPHY, SPACING, RADIUS, LIVING_FIELD, ALIVE } from '../theme/designTokens';

export { FONTS, TYPOGRAPHY, SPACING, RADIUS, LIVING_FIELD, ALIVE };
