/**
 * OGAM-owned interactive guide topics, curated answers, incremental typing-reveal helpers, and
 * grounded mobile how-to flow KB (`GUIDE_FLOWS` / `GUIDE_NOT_SUPPORTED`).
 *
 * Every UI label named in a mobile flow matches actual text/labels present in `src/` so the guide
 * never points the user at a removed control.
 */

export const GUIDE_KB_VECTOR_MODEL = 'all-MiniLM-L6-v2';

export const GUIDE_LINKS = {
  mobile: 'https://offgridai.app',
  desktop: 'https://offgridai.app/desktop',
  extension: 'https://offgridai.app/extension',
} as const;

export type GuideWhere = 'mobile' | 'desktop' | 'extension' | 'both' | 'everywhere';

export interface GuideGroup {
  id: string;
  title: string;
}

export const MOBILE_GUIDE_GROUPS: readonly GuideGroup[] = [
  { id: 'chat-media', title: 'Chat, voice & media' },
  { id: 'workspace-tools', title: 'Files, Pro & privacy' },
  { id: 'everywhere', title: 'Across your devices' },
];

export interface GuideTopicFacts {
  id: string;
  label: string;
  tagline: string;
  description: string;
  highlights: string[];
  group: string;
  where: GuideWhere;
  pro?: boolean;
  get?: 'mobile' | 'desktop' | 'extension';
}

const MOBILE_TOPICS: readonly GuideTopicFacts[] = [
  {
    id: 'phone-chat',
    label: 'Private Chat',
    tagline: 'Fast offline AI chat running directly on your phone.',
    description: 'Run GGUF text and reasoning models locally without sending conversations to the cloud.',
    highlights: [
      'Works offline after downloading a model',
      'Supports thinking budgets, tools, and custom system prompts',
      'Connects optionally to remote servers on your Wi-Fi',
    ],
    group: 'chat-media',
    where: 'mobile',
  },
  {
    id: 'phone-vision',
    label: 'Vision',
    tagline: 'Ask questions about photos, screenshots, and documents.',
    description: 'Attach camera photos or gallery images in chat and analyze them locally with multimodal vision models.',
    highlights: [
      'Pairs multimodal projectors automatically on download',
      'Take photos directly or pick from your photo library',
      'Runs locally with full privacy',
    ],
    group: 'chat-media',
    where: 'mobile',
  },
  {
    id: 'phone-images',
    label: 'Image Studio',
    tagline: 'Generate pictures locally from plain text prompts.',
    description: 'Create images on-device using Stable Diffusion checkpoints, NPU/GPU packs, or multi-file DiT models.',
    highlights: [
      'Auto-detect image requests or trigger generation directly',
      'Adjust steps, guidance scale, size, and threads per model',
      'Saves creations locally to Gallery',
    ],
    group: 'chat-media',
    where: 'mobile',
  },
  {
    id: 'phone-speech',
    label: 'Speech-to-Text',
    tagline: 'Dictate prompts and transcribe audio recordings offline.',
    description: 'Use bundled or downloadable Whisper and Qwen3-ASR models right inside the composer.',
    highlights: [
      'Supports English-only and multilingual models',
      'Tap-to-record or hold-and-slide to cancel',
      'Re-transcribe recordings directly from message actions',
    ],
    group: 'chat-media',
    where: 'mobile',
  },
  {
    id: 'phone-voice',
    label: 'Voice Playback',
    tagline: 'Hear replies spoken aloud with on-device voices.',
    description: 'Listen to assistant answers or start hands-free voice conversations using local speech synthesis.',
    highlights: [
      'Tap Speak on any assistant reply',
      'Configure automatic engine updates and voice models',
      'Keeps voice audio completely local',
    ],
    group: 'chat-media',
    where: 'mobile',
    pro: true,
  },
  {
    id: 'phone-video',
    label: 'Video Studio',
    tagline: 'Turn text prompts or starting frames into short clips.',
    description: 'Generate video locally on high-memory devices or offload rendering to Off Grid AI Desktop.',
    highlights: [
      'Supports Wan 2.1 T2V and Wan 2.2 TI2V image-to-video',
      'Manage background video jobs and previews cleanly',
      'Save finished clips into Gallery',
    ],
    group: 'chat-media',
    where: 'both',
    pro: true,
  },
  {
    id: 'phone-documents',
    label: 'Documents & Projects',
    tagline: 'Organize knowledge files and retrieve cited answers.',
    description: 'Group chats inside Projects, attach PDFs or text notes, and search semantically with built-in embeddings.',
    highlights: [
      'Attach files to individual chats or shared project bases',
      'Choose MiniLM L6, L12, or Multilingual MiniLM search models',
      'Switch Document search models anytime in Settings',
    ],
    group: 'workspace-tools',
    where: 'mobile',
  },
  {
    id: 'phone-tools',
    label: 'Tools & Skills',
    tagline: 'Connect calculators, calendar actions, web search, and MCP.',
    description: 'Give models controlled access to built-in utilities or Pro productivity connectors with explicit approval.',
    highlights: [
      'Inspect and toggle Pro tools from ToolsScreen',
      'Optional Web Search setting and MCP server integrations',
      'Deterministic tool execution safeguards',
    ],
    group: 'workspace-tools',
    where: 'mobile',
    pro: true,
  },
  {
    id: 'phone-models',
    label: 'Model Manager',
    tagline: 'Curated phone picks, Hugging Face search, and local imports.',
    description: 'Pick Fast, Balanced, or Best models tailored to your RAM, import GGUF/LiteRT files, and manage storage.',
    highlights: [
      'Automatic compatibility & memory-budget screening',
      'Resume paused downloads and inspect leftover files',
      'Support for llama.cpp GGUF and Google LiteRT acceleration',
    ],
    group: 'workspace-tools',
    where: 'mobile',
  },
  {
    id: 'phone-notes',
    label: 'Notes',
    tagline: 'Capture, organize, and link private notes with Pro.',
    description: 'Keep structured notes synced across your own encrypted devices alongside your AI workspace.',
    highlights: [
      'Sync notes peer-to-peer with Off Grid AI Desktop',
      'Use AI assistance inside your note collection',
      'Stored privately without third-party servers',
    ],
    group: 'workspace-tools',
    where: 'both',
    pro: true,
  },
  {
    id: 'phone-improve',
    label: 'Text Improve',
    tagline: 'Rewrite and polish selected text from Android share actions.',
    description: 'Select text anywhere on your phone and refine wording locally without cloud clipboard telemetry.',
    highlights: [
      'Available across Android apps via text actions',
      'Preserves tone and private data locally',
      'Unlocked with Off Grid AI Pro',
    ],
    group: 'workspace-tools',
    where: 'mobile',
    pro: true,
  },
  {
    id: 'phone-vault',
    label: 'Private Vault',
    tagline: 'Store sensitive snippets with app lock protection.',
    description: 'Protect confidential data behind passphrase lock and encrypted device boundaries.',
    highlights: [
      'Guard access via Security passphrase settings',
      'Never uploaded to external servers',
      'Synchronizable only with explicitly paired devices',
    ],
    group: 'workspace-tools',
    where: 'mobile',
    pro: true,
  },
  {
    id: 'phone-clipboard',
    label: 'Synced Clipboard',
    tagline: 'Copy on your phone, paste straight on Desktop.',
    description: 'Share snippets securely over local encrypted sync with your paired computer.',
    highlights: [
      'Peer-to-peer local network transfer',
      'Copy here, paste there when Pro Sync is active',
      'Instant handoff between phone and Desktop',
    ],
    group: 'everywhere',
    where: 'both',
    pro: true,
  },
  {
    id: 'phone-sync',
    label: 'Device Sync',
    tagline: 'Live encrypted sync between your phone and computer.',
    description: 'Keep chats, shared files, remote tasks, and model access working together over your local network.',
    highlights: [
      'Show sync status bar toggle in Settings',
      'Inspect and manage paired desktop endpoints',
      'No cloud intermediary required',
    ],
    group: 'everywhere',
    where: 'both',
    pro: true,
  },
  {
    id: 'computer',
    label: 'Off Grid AI Desktop',
    tagline: 'Run heavy local LLMs, Image Studio, and Video Studio on Desktop.',
    description: 'Use your Mac, Windows, or Linux machine as a high-VRAM companion server or standalone workspace.',
    highlights: [
      'Auto-discover Desktop on local Wi-Fi from Remote servers',
      'Offload large text, image, video, and voice workloads',
      'Keep everything on hardware you control',
    ],
    group: 'everywhere',
    where: 'desktop',
    get: 'desktop',
  },
  {
    id: 'extension',
    label: 'Browser Extension',
    tagline: 'Bring local AI assistance straight into web pages.',
    description: 'Summarize pages, draft replies, and connect your desktop models inside your browser.',
    highlights: [
      'Talks directly to Off Grid AI Desktop',
      'Zero third-party API tracking',
      'Shares the same local-first privacy architecture',
    ],
    group: 'everywhere',
    where: 'extension',
    get: 'extension',
  },
];

export const GUIDE_FIRST_LOOK = {
  mobile: ['phone-chat', 'phone-vision', 'phone-images', 'phone-voice'],
  desktop: ['computer', 'extension'],
} as const;

export const GUIDE_STARTERS = {
  mobile: [
    'What does Pro add on my phone?',
    'What can this phone do offline?',
    'How do I download a model?',
    'How does voice mode work?',
  ],
  desktop: [
    'What does Pro add on Desktop?',
    'How do I connect my phone?',
  ],
} as const;

export function guideTopicsFor(_surface: 'mobile' | 'desktop'): GuideTopicFacts[] {
  return MOBILE_TOPICS.map(t => ({ ...t, highlights: [...t.highlights] }));
}

export function guideWhereLabel(_surface: 'mobile' | 'desktop', where: GuideWhere): string {
  switch (where) {
    case 'mobile':
      return 'On this phone';
    case 'desktop':
      return 'On your computer';
    case 'extension':
      return 'In your browser';
    case 'both':
      return 'Phone & Computer';
    default:
      return 'Everywhere';
  }
}

export type GuideAnswerPart<T> =
  | { kind: 'text'; text: string }
  | { kind: 'topic'; topic: T }
  | { kind: 'picks'; picks: Array<{ id: string; label: string }> };

export type GuideAnswerBlock<T> =
  | { kind: 'text'; text: string }
  | { kind: 'topics'; topics: T[] }
  | { kind: 'picks'; picks: Array<{ id: string; label: string }> };

const MARKER_RE = /\[\[(topic|pick):([^\]]+)\]\]/g;

/** Splits raw guide markdown containing `[[topic:id]]` or `[[pick:id|label]]` markers into structured parts. */
export function guideAnswerParts<T extends { id: string }>(
  content: string,
  topics: readonly T[],
): GuideAnswerPart<T>[] {
  const byId = new Map(topics.map(t => [t.id, t]));
  const parts: GuideAnswerPart<T>[] = [];
  let cursor = 0;
  MARKER_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = MARKER_RE.exec(content)) !== null) {
    if (match.index > cursor) {
      const chunk = content.slice(cursor, match.index).trim();
      if (chunk) parts.push({ kind: 'text', text: chunk });
    }
    const markerType = match[1];
    const payload = match[2];
    if (markerType === 'topic') {
      const topic = byId.get(payload.trim());
      if (topic) parts.push({ kind: 'topic', topic });
    } else if (markerType === 'pick') {
      const sep = payload.indexOf('|');
      const id = (sep >= 0 ? payload.slice(0, sep) : payload).trim();
      const label = (sep >= 0 ? payload.slice(sep + 1) : payload).trim();
      if (id && label) parts.push({ kind: 'picks', picks: [{ id, label }] });
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < content.length) {
    const tail = content.slice(cursor).trim();
    if (tail) parts.push({ kind: 'text', text: tail });
  }

  return parts;
}

/** Merges consecutive topic or pick parts into layout blocks matching the GuideScreen renderer. */
export function guideAnswerBlocks<T>(parts: readonly GuideAnswerPart<T>[]): GuideAnswerBlock<T>[] {
  const blocks: GuideAnswerBlock<T>[] = [];

  for (const part of parts) {
    if (part.kind === 'text') {
      blocks.push({ kind: 'text', text: part.text });
    } else if (part.kind === 'topic') {
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === 'topics') {
        prev.topics.push(part.topic);
      } else {
        blocks.push({ kind: 'topics', topics: [part.topic] });
      }
    } else {
      const prev = blocks[blocks.length - 1];
      if (prev && prev.kind === 'picks') {
        prev.picks.push(...part.picks);
      } else {
        blocks.push({ kind: 'picks', picks: [...part.picks] });
      }
    }
  }

  return blocks;
}

/** Returns total typable character count across text blocks in a guide answer. */
export function guideAnswerLength<T>(blocks: readonly GuideAnswerBlock<T>[]): number {
  let total = 0;
  for (const block of blocks) {
    if (block.kind === 'text') total += block.text.length;
  }
  return total;
}

/** Smooth sub-second typing duration shared by desktop and mobile guide answers. */
export function guideTypingMs(totalChars: number): number {
  if (totalChars <= 0) return 0;
  return Math.min(900, Math.max(220, Math.round(totalChars * 3.5)));
}

/** Slices text blocks to `shownChars`; emits topic cards and flow pick lists only once typing completes. */
export function guideAnswerReveal<T>(
  blocks: readonly GuideAnswerBlock<T>[],
  shownChars: number,
): GuideAnswerBlock<T>[] {
  const total = guideAnswerLength(blocks);
  if (shownChars >= total) {
    return [...blocks];
  }
  if (shownChars <= 0) {
    return [];
  }

  let remaining = shownChars;
  const revealed: GuideAnswerBlock<T>[] = [];
  for (const block of blocks) {
    if (block.kind !== 'text') continue;
    if (remaining <= 0) break;
    const take = block.text.slice(0, remaining);
    if (take) revealed.push({ kind: 'text', text: take });
    remaining -= take.length;
  }
  return revealed;
}

export interface GuideFlowEntry {
  id: string;
  surface: 'mobile' | 'desktop' | 'cross';
  source: string;
  title: string;
  steps: string[];
  labels: string[];
  keywords: string[];
  platform?: 'android' | 'ios';
}

export interface GuideNotSupportedEntry {
  id: string;
  surface: 'mobile' | 'desktop' | 'cross';
  source: string;
  title: string;
  reason: string;
  labels: string[];
  keywords: string[];
}

function flow(
  id: string,
  source: string,
  title: string,
  labels: string[],
  keywords: string[],
  steps?: string[],
  platform?: 'android' | 'ios',
): GuideFlowEntry {
  return {
    id,
    surface: 'mobile',
    source: source.startsWith('mobile/') ? source : `mobile/${source}`,
    title,
    labels,
    keywords,
    steps:
      steps ??
      labels.map((label, idx) => `${idx + 1}. Tap **${label}**.`),
    ...(platform ? { platform } : {}),
  };
}

function unsupported(
  id: string,
  source: string,
  title: string,
  labels: string[],
  keywords: string[],
  reason: string,
): GuideNotSupportedEntry {
  return {
    id,
    surface: 'mobile',
    source: source.startsWith('mobile/') ? source : `mobile/${source}`,
    title,
    labels,
    keywords,
    reason,
  };
}

export const GUIDE_FLOWS: readonly GuideFlowEntry[] = [
  // ModelsScreen & Tabs
  flow('models-open', 'src/screens/ModelsScreen/index.tsx', 'Open Models', ['Models'], ['models', 'open', 'tab']),
  flow('models-check-remote', 'src/screens/ModelsScreen/index.tsx', 'Check for new models', ['Models', 'Check for new models'], ['check', 'new', 'models', 'catalog', 'refresh']),
  flow('models-tab-text', 'src/screens/ModelsScreen/index.tsx', 'Browse Text models', ['Models', 'Text'], ['text', 'chat', 'llm', 'models']),
  flow('models-tab-documents', 'src/screens/ModelsScreen/index.tsx', 'Browse Document search models', ['Models', 'Documents'], ['documents', 'embedding', 'search', 'models']),
  flow('models-tab-image', 'src/screens/ModelsScreen/index.tsx', 'Browse Image models', ['Models', 'Image'], ['image', 'sd', 'stable', 'diffusion', 'models']),
  flow('models-tab-video', 'src/screens/ModelsScreen/index.tsx', 'Browse Video models', ['Models', 'Video'], ['video', 'wan', 'clip', 'models']),
  flow('models-tab-voice', 'src/screens/ModelsScreen/index.tsx', 'Browse Voice models', ['Models', 'Voice'], ['voice', 'tts', 'speech']),
  flow('models-tab-speech', 'src/screens/ModelsScreen/index.tsx', 'Browse Speech-to-Text models', ['Models', 'Speech'], ['speech', 'whisper', 'asr', 'transcribe']),
  flow('models-import-local', 'src/screens/ModelsScreen/TextModelsTab.tsx', 'Import a local GGUF or LiteRT file', ['Import local file'], ['import', 'local', 'gguf', 'litert', 'file']),
  flow('models-sort', 'src/screens/ModelsScreen/TextModelsTab.tsx', 'Sort text models', ['Sort models'], ['sort', 'text', 'models']),
  flow('models-filter', 'src/screens/ModelsScreen/TextModelsTab.tsx', 'Filter text models', ['Filter models'], ['filter', 'text', 'models']),
  flow('models-sizes', 'src/screens/ModelsScreen/TextModelsTab.tsx', 'Choose quantization size', ['Sizes'], ['size', 'quantization', 'smaller', 'recommended', 'best']),
  flow('models-size-recommended', 'src/screens/ModelsScreen/sizeChoices.ts', 'Pick the recommended size', ['Recommended'], ['recommended', 'size', 'quant']),
  flow('models-size-smaller', 'src/screens/ModelsScreen/sizeChoices.ts', 'Pick a smaller model size', ['Smaller'], ['smaller', 'size', 'ram', 'fit']),
  flow('models-size-best', 'src/screens/ModelsScreen/sizeChoices.ts', 'Pick the best quality size', ['Best'], ['best', 'size', 'quality']),
  flow('models-filter-org', 'src/screens/ModelsScreen/TextFiltersSection.tsx', 'Filter models by organization', ['Org', 'Clear'], ['org', 'maker', 'organization', 'filter']),
  flow('models-filter-constants-types', 'src/screens/ModelsScreen/constants.ts', 'Filter by Text, Vision, or Code', ['All Types', 'Text', 'Vision', 'Code'], ['type', 'vision', 'code', 'filter']),
  flow('models-filter-credibility', 'src/screens/ModelsScreen/constants.ts', 'Filter by publisher trust badge', ['LM Studio', 'Official', 'Verified', 'Community'], ['official', 'verified', 'lmstudio', 'community']),
  flow('models-filter-image-style', 'src/screens/ModelsScreen/constants.ts', 'Filter image models by style', ['All Styles', 'Realistic', 'Anime'], ['style', 'realistic', 'anime', 'image']),
  flow('models-filter-image-version', 'src/screens/ModelsScreen/constants.ts', 'Filter image models by architecture', ['All Versions', 'SD 1.5', 'SD 2.1', 'SDXL'], ['sdxl', 'sd15', 'version', 'image']),
  flow('models-clear-image-filter', 'src/screens/ModelsScreen/ImageFilterBar.tsx', 'Clear image filters', ['Clear'], ['clear', 'image', 'filter']),
  flow('models-retry-image', 'src/screens/ModelsScreen/ImageModelsTab.tsx', 'Retry loading image models', ['Retry'], ['retry', 'image', 'models', 'load']),
  flow('models-asr-languages', 'src/screens/ModelsScreen/TranscriptionModelsTab.tsx', 'Choose Whisper or Qwen3-ASR speech models', ['English only', 'Multilingual - 99 languages', 'Multilingual - 30 languages'], ['whisper', 'qwen3', 'asr', 'english', 'multilingual']),
  flow('models-embed-cancel', 'src/screens/ModelsScreen/EmbeddingModelsTab.tsx', 'Cancel embedding model switch', ['Cancel model change'], ['cancel', 'embedding', 'document', 'switch']),

  // ChatScreen & Composer & Messages
  flow('chat-new', 'src/screens/ChatScreen/ChatScreenComponents.tsx', 'Start a new chat', ['New chat'], ['new', 'chat', 'start', 'conversation']),
  flow('chat-settings', 'src/screens/ChatScreen/ChatScreenComponents.tsx', 'Open Chat settings', ['Chat settings', 'Save'], ['chat', 'settings', 'save']),
  flow('chat-select-model', 'src/screens/ChatScreen/ChatScreenComponents.tsx', 'Select a model for chat', ['No Model Selected', 'Select Model'], ['select', 'model', 'load', 'chat']),
  flow('chat-attach', 'src/components/ChatInput/ComposerIconsRow.tsx', 'Attach photos or documents', ['Attach', 'Photo', 'Document'], ['attach', 'photo', 'document', 'camera', 'file']),
  flow('chat-take-photo', 'src/components/ChatInput/index.tsx', 'Take a photo in chat', ['Take photo'], ['camera', 'take', 'photo', 'picture']),
  flow('chat-choose-photo', 'src/components/ChatInput/index.tsx', 'Choose a photo from library', ['Choose photo'], ['gallery', 'choose', 'photo', 'image']),
  flow('chat-options', 'src/components/ChatInput/ComposerIconsRow.tsx', 'Open chat composer options', ['Chat options'], ['options', 'composer', 'chat']),
  flow('chat-stop-reply', 'src/components/ChatInput/index.tsx', 'Stop AI generation early', ['Stop reply'], ['stop', 'cancel', 'reply', 'generation']),
  flow('chat-voice-recording', 'src/components/ChatInput/RecordingHint.tsx', 'Record or cancel voice input', ['Tap mic to stop', 'Slide to cancel'], ['record', 'mic', 'voice', 'dictation', 'cancel']),
  flow('chat-queue-send', 'src/components/ChatInput/Toolbar.tsx', 'Send or clear queued messages', ['Send queued messages', 'Clear queued messages'], ['queue', 'send', 'clear', 'messages']),
  flow('chat-queue-item', 'src/components/ChatInput/Toolbar.tsx', 'Send or remove one queued message', ['Send queued message now', 'Remove from queue'], ['queued', 'remove', 'now']),
  flow('chat-msg-actions', 'src/components/ChatMessage/components/ActionMenuSheet.tsx', 'Copy, edit, speak, or retry a message', ['Copy', 'Edit', 'Speak', 'Generate Image'], ['copy', 'edit', 'speak', 'tts', 'message']),
  flow('chat-msg-transcribe', 'src/components/ChatMessage/components/ActionMenuSheet.tsx', 'Re-transcribe a voice message', ['Transcribe again'], ['transcribe', 'again', 'audio', 'whisper']),
  flow('chat-msg-details', 'src/components/ChatMessage/components/GenerationMeta.tsx', 'View message generation stats', ['Generation details'], ['stats', 'details', 'tokens', 'speed']),
  flow('chat-pip-media', 'src/components/ChatMessage/components/MessageAttachments.tsx', 'Open picture-in-picture video preview', ['Picture in picture'], ['pip', 'video', 'preview', 'picture']),
  flow('chat-delete', 'src/components/GenerationSettingsModal/ConversationActionsSection.tsx', 'Delete current conversation', ['Delete chat'], ['delete', 'chat', 'remove']),
  flow('chat-docs-sheet', 'src/components/ChatDocumentsSheet.tsx', 'Inspect documents in this chat', ['Documents in this chat'], ['documents', 'attached', 'rag', 'chat']),
  flow('chat-system-prompt', 'src/components/GenerationSettingsModal/TextGenerationSection.tsx', 'Edit the default system prompt', ['Default System Prompt'], ['system', 'prompt', 'persona']),
  flow('chat-image-autodetect', 'src/components/GenerationSettingsModal/ImageGenerationSection.tsx', 'Configure auto-detect image requests', ['Auto-detect image requests', 'Detection method'], ['detect', 'image', 'auto', 'intent']),
  flow('chat-image-enhance', 'src/components/GenerationSettingsModal/ImageGenerationSection.tsx', 'Enable image prompt enhancement', ['Enhance image prompts'], ['enhance', 'prompt', 'image']),
  flow('chat-image-sliders', 'src/components/GenerationSettingsModal/ImageQualitySliders.tsx', 'Tune image quality, steps, and GPU', ['Image steps', 'Image size', 'Guidance Scale', 'GPU Acceleration'], ['steps', 'guidance', 'gpu', 'size', 'defaults']),
  flow('chat-debug-sheet', 'src/components/DebugSheet.tsx', 'Inspect prompt & token context stats', ['Debug Info', 'Context Stats', 'Tokens Used'], ['debug', 'tokens', 'context', 'prompt']),

  // Downloads & Device Picks & Selectors
  flow('downloads-open', 'src/screens/DownloadManagerScreen/index.tsx', 'View active and finished downloads', ['Downloads'], ['downloads', 'manager', 'progress']),
  flow('downloads-filter', 'src/screens/DownloadManagerScreen/index.tsx', 'Filter downloads by category', ['All', 'Text', 'Documents', 'Image', 'Video'], ['filter', 'downloads', 'category']),
  flow('download-pause-resume', 'src/components/ModelCardContent.tsx', 'Pause, resume, or cancel a model download', ['Pause download', 'Resume download', 'Cancel download'], ['pause', 'resume', 'cancel', 'download']),
  flow('download-retry', 'src/components/ModelCard.tsx', 'Retry or remove a failed download', ['Retry download', 'Remove download'], ['retry', 'failed', 'remove', 'download']),
  flow('picks-chat-now', 'src/components/models/DevicePicksRow.tsx', 'Start chatting right from a device pick', ['Chat now'], ['pick', 'chat', 'fast', 'balanced', 'best']),
  flow('models-manager-sheet', 'src/components/models/ModelsManagerSheet.tsx', 'Unload all loaded models', ['Eject all models', 'Refresh models'], ['eject', 'unload', 'ram', 'refresh']),
  flow('models-selector-unload', 'src/components/ModelSelectorModal/TextTab.tsx', 'Unload the currently active text model', ['Currently Loaded', 'Unload'], ['unload', 'loaded', 'text', 'model']),
  flow('models-selector-whisper', 'src/components/models/WhisperPickerSheet.tsx', 'Pick an installed transcription model', ['TRANSCRIPTION MODEL', 'On this phone'], ['whisper', 'picker', 'speech']),

  // Projects & Knowledge Base
  flow('projects-create', 'src/screens/ProjectsScreen.tsx', 'Create a new project workspace', ['Projects', 'New project'], ['project', 'new', 'create', 'folder']),
  flow('projects-detail', 'src/screens/ProjectDetailScreen.tsx', 'Edit project details or launch a project chat', ['Edit project', 'New chat', 'What it knows'], ['project', 'detail', 'edit', 'chat']),
  flow('projects-edit', 'src/screens/ProjectEditScreen.tsx', 'Update description or delete a project', ['Save', 'Delete project'], ['save', 'delete', 'project']),
  flow('kb-add-files', 'src/screens/KnowledgeBaseScreen.tsx', 'Add files or paste notes into a Knowledge Base', ['Files', 'Add files', 'Paste text'], ['knowledge', 'files', 'add', 'paste', 'rag']),
  flow('kb-paste-note', 'src/components/knowledge/PasteNoteSheet.tsx', 'Save pasted text as a knowledge document', ['Note title', 'Note text', 'Save to Files'], ['paste', 'note', 'save', 'files']),

  // Chats List & Gallery & Media Restyle
  flow('chats-list-select', 'src/screens/ChatsListScreen.tsx', 'Select and delete multiple conversations', ['Chats', 'Select chats', 'Delete selected chats'], ['select', 'delete', 'chats', 'bulk']),
  flow('chats-list-options', 'src/components/ChatListOptionsSheet.tsx', 'Sort or group conversation history', ['Group by', 'Sort by', 'Last updated', 'Created'], ['group', 'sort', 'project', 'date', 'chats']),
  flow('gallery-browse', 'src/screens/GalleryScreen/index.tsx', 'View generated images and video clips', ['Stories and clips', 'Select images'], ['gallery', 'images', 'videos', 'clips']),
  flow('gallery-delete-batch', 'src/screens/GalleryScreen/index.tsx', 'Delete multiple gallery items', ['Delete selected images', 'Stop image generation'], ['delete', 'gallery', 'stop']),
  flow('gallery-image-actions', 'src/screens/GalleryScreen/GalleryImageScreen.tsx', 'Save or delete a generated image', ['Details and actions', 'Save', 'Delete'], ['save', 'delete', 'gallery', 'image']),
  flow('gallery-video-actions', 'src/screens/GalleryScreen/GalleryVideoScreen.tsx', 'Inspect prompt and delete a video clip', ['Details and actions', 'PROMPT', 'Delete'], ['video', 'prompt', 'delete', 'gallery']),
  flow('media-restyle', 'src/components/MediaStyles/StyleRow.tsx', 'Apply or clear visual generation styles', ['Style', 'Clear style'], ['style', 'cinematic', 'nature', 'restyle']),

  // Settings, Security, Storage, Diagnostics, Remote Servers, Pro
  flow('settings-open', 'src/screens/SettingsScreen.tsx', 'Open Settings overview', ['Settings'], ['settings', 'preferences']),
  flow('settings-appearance', 'src/screens/SettingsAppearanceRow.tsx', 'Switch between System, Light, or Dark theme', ['Appearance', 'System', 'Light', 'Dark'], ['theme', 'dark', 'light', 'appearance']),
  flow('settings-model-settings', 'src/screens/ModelSettingsScreen/index.tsx', 'Configure text, image, voice, and ASR defaults', ['Model settings', 'Reset to defaults'], ['model', 'settings', 'reset', 'defaults']),
  flow('settings-doc-search', 'src/screens/SearchModelScreen.tsx', 'Choose Document search embedding model', ['Document search'], ['document', 'search', 'embedding', 'minilm']),
  flow('settings-web-search', 'src/screens/SettingsScreen.tsx', 'Toggle Web Search tool access', ['Web Search'], ['web', 'search', 'internet', 'tool']),
  flow('settings-sync-bar', 'src/screens/SettingsScreen.tsx', 'Toggle the live sync status bar', ['Show sync status bar'], ['sync', 'status', 'bar']),
  flow('settings-device-info', 'src/screens/DeviceInfoScreen.tsx', 'Inspect hardware specs and memory headroom', ['Device information', 'Hardware', 'What runs here', 'Memory'], ['device', 'hardware', 'ram', 'memory', 'cpu']),
  flow('settings-engine-updates', 'src/screens/EngineUpdatesScreen.tsx', 'Review automatic runtime engine updates', ['Engine updates', 'Automatic engine updates'], ['engine', 'update', 'llama', 'version']),
  flow('settings-storage-usage', 'src/screens/StorageSettingsScreen.tsx', 'Inspect storage usage by category', ['Storage', 'Space on this phone', 'Chat models', 'Image models'], ['storage', 'space', 'disk', 'cleanup']),
  flow('settings-storage-orphans', 'src/screens/OrphanedFilesSection.tsx', 'Delete orphaned leftover model files', ['Leftover files', 'Delete all'], ['leftover', 'orphan', 'delete', 'cleanup']),
  flow('settings-storage-clear', 'src/screens/StorageSettingsScreen.tsx', 'Clear unfinished downloads or cache', ['Unfinished downloads', 'Clear all'], ['unfinished', 'clear', 'storage']),
  flow('settings-security-lock', 'src/screens/SecuritySettingsScreen.tsx', 'Set up App lock and passphrase protection', ['Security', 'App lock', 'Passphrase lock', 'Change passphrase'], ['security', 'lock', 'passphrase', 'pin']),
  flow('settings-passphrase-confirm', 'src/screens/PassphraseSetupScreen.tsx', 'Change or confirm your lock passphrase', ['Current passphrase', 'Confirm passphrase'], ['passphrase', 'confirm', 'password']),
  flow('settings-remote-scan', 'src/screens/RemoteServersScreen.tsx', 'Scan Wi-Fi for Desktop, Ollama, or LM Studio', ['Remote servers', 'Scan network', 'Add manually', 'Auto-discover on Wi-Fi'], ['remote', 'server', 'ollama', 'lmstudio', 'desktop', 'scan']),
  flow('settings-remote-editor', 'src/screens/RemoteServerEditorScreen.tsx', 'Configure remote server URL and modalities', ['Server name', 'Address', 'Text model', 'Remove server'], ['server', 'address', 'endpoint', 'remote']),
  flow('settings-auto-setup', 'src/screens/AutoSetupScreen.tsx', 'Re-run guided setup or find Desktop', ['Choose models', 'Find my computer', 'Continue'], ['setup', 'auto', 'onboarding', 'computer']),
  flow('settings-reset-onboarding', 'src/screens/SettingsScreen.tsx', 'Restart the onboarding flow', ['Reset onboarding'], ['reset', 'onboarding', 'welcome']),
  flow('settings-debug-logs', 'src/components/DebugLogsScreen/index.tsx', 'View, copy, share, or clear diagnostic logs', ['Debug Logs', 'Copy All', 'Share', 'Clear'], ['logs', 'debug', 'diagnostics', 'share']),
  flow('settings-about', 'src/screens/AboutScreen.tsx', 'View app info and source code link', ['About', 'View the source on GitHub'], ['about', 'github', 'version', 'license']),
  flow('settings-analytics-info', 'src/screens/AnalyticsInfoScreen.tsx', 'Check privacy sharing boundaries', ['What we share', 'We never share'], ['privacy', 'telemetry', 'analytics', 'share']),
  flow('home-remote-add', 'src/screens/HomeScreen/index.tsx', 'Quick-open Remote Server setup from Home', ['Add Remote Server', 'What it does for you'], ['home', 'remote', 'guide']),
  flow('pro-overview', 'src/screens/ProDetailScreen/index.tsx', 'Review Off Grid AI Pro features or activate license', ['Off Grid AI Pro', 'I have a license key', 'Get Pro'], ['pro', 'license', 'key', 'unlock']),
  flow('pro-manage', 'src/screens/ProDetailScreen/ProManageSection.tsx', 'Manage licensed devices or reset Pro', ['Manage licensed devices in Sync', 'Reset Pro on this phone'], ['pro', 'devices', 'reset', 'licence']),
  flow('tools-pro-screen', 'src/screens/ToolsScreen/index.tsx', 'Inspect connected Pro tools and MCP integrations', ['Tools', 'Pro tools', 'Email, calendar and MCP servers'], ['tools', 'mcp', 'email', 'calendar']),
  flow('guide-new-question', 'src/screens/GuideScreen/index.tsx', 'Start a fresh guide question or browse Features', ['What it does for you', 'New question'], ['guide', 'help', 'new', 'features']),
  flow('guide-topic-ask-more', 'src/screens/GuideScreen/GuideTopicScreen.tsx', 'Ask follow-up questions about any feature', ['Ask more'], ['ask', 'more', 'topic', 'guide']),
  flow('android-open-settings-storage', 'src/screens/StorageSettingsScreen.tsx', 'Clean finished downloads on Android storage', ['All models', 'Choose models for this phone'], ['android', 'storage', 'models'], undefined, 'android'),
  flow('ios-open-models-tab', 'src/screens/ModelsScreen/index.tsx', 'Manage models on iPhone', ['Models', 'Text', 'Image'], ['ios', 'iphone', 'models'], undefined, 'ios'),
];

export const GUIDE_NOT_SUPPORTED: readonly GuideNotSupportedEntry[] = [
  unsupported(
    'ns-cloud-training',
    'src/screens/ModelsScreen/index.tsx',
    'Train or fine-tune custom model weights on phone',
    ['Models', 'Import local file'],
    ['train', 'fine-tune', 'lora', 'training'],
    'Mobile devices only run inference on pre-quantized models; fine-tuning or LoRA training is not supported on phone.',
  ),
  unsupported(
    'ns-background-screen-scrape',
    'src/screens/SettingsScreen.tsx',
    'Continuous silent background screen recording',
    ['Settings', 'Security'],
    ['screen', 'record', 'continuous', 'always', 'watch'],
    'The app never records or streams your screen continuously in the background; attachments are sent only on explicit user action.',
  ),
  unsupported(
    'ns-cloud-account-sync',
    'src/screens/RemoteServersScreen.tsx',
    'Cloud-hosted conversation backup without self-hosting',
    ['Remote servers', 'Get Off Grid AI Desktop'],
    ['cloud', 'account', 'login', 'hosted', 'backup'],
    'Off Grid AI has no cloud user accounts or cloud chat storage; device sync works peer-to-peer over your own network with Desktop.',
  ),
  unsupported(
    'ns-multi-user-server',
    'src/screens/RemoteServersScreen.tsx',
    'Host an external multi-tenant inference API from phone',
    ['Remote servers', 'Scan network'],
    ['host', 'api', 'server', 'expose', 'public'],
    'The phone acts as a client to local or user-configured servers rather than exposing a public multi-user HTTP endpoint.',
  ),
  unsupported(
    'ns-model-format-safetensors-llm',
    'src/screens/ModelsScreen/TextModelsTab.tsx',
    'Load raw PyTorch/safetensors LLM weights directly for chat',
    ['Import local file', 'Sizes'],
    ['pytorch', 'safetensors', 'chat', 'raw'],
    'On-device chat inference uses quantized GGUF or LiteRT bundles, whereas raw safetensors files belong to SD checkpoints/packs.',
  ),
  unsupported(
    'ns-video-low-ram',
    'src/screens/ModelsScreen/index.tsx',
    'Run 5B video diffusion on phones under 16 GB RAM',
    ['Models', 'Video'],
    ['video', 'wan2.2', 'low', 'ram', '8gb'],
    'Large video diffusion weights require high device RAM or Off Grid AI Desktop offload and are hidden on phones that cannot fit them safely.',
  ),
  unsupported(
    'ns-pro-without-desktop-sync',
    'src/screens/ProDetailScreen/ProIncludedSection.tsx',
    'Desktop-bridged tools and clipboard without Desktop connected',
    ['Included with Pro', 'Live sync across your devices'],
    ['desktop', 'clipboard', 'bridge', 'offline'],
    'Synced clipboard and Desktop-executed workflows require Off Grid AI Pro paired with a reachable Desktop instance.',
  ),
  unsupported(
    'ns-mcp-arbitrary-shell-on-ios',
    'src/screens/ToolsScreen/index.tsx',
    'Run local desktop bash/filesystem MCP servers natively on phone',
    ['Tools', 'Pro tools'],
    ['bash', 'shell', 'terminal', 'mcp', 'local'],
    'Desktop host shell MCP servers execute on your computer via Sync rather than inside the mobile OS sandbox.',
  ),
  unsupported(
    'ns-automatic-telemetry-upload',
    'src/screens/AnalyticsInfoScreen.tsx',
    'Upload prompts, notes, or private files for analytics',
    ['What we share', 'We never share'],
    ['upload', 'prompts', 'analytics', 'telemetry', 'collect'],
    'Prompts, personal files, and private memory content are never included in crash or diagnostic reports.',
  ),
  unsupported(
    'ns-hub-auto-download-all',
    'src/screens/ModelDownloadScreen.tsx',
    'Auto-download large 30B+ desktop models onto phone',
    ['On this device', 'Total memory'],
    ['30b', '70b', 'huge', 'auto'],
    'Auto Setup caps selections using your measured hardware RAM budget and hides models that exceed device limits.',
  ),
  unsupported(
    'ns-legacy-unquantized-fp32',
    'src/screens/DeviceInfoScreen.tsx',
    'Run uncompressed FP32 chat models on mobile',
    ['Device information', 'Memory'],
    ['fp32', 'uncompressed', 'f32'],
    'Mobile inference builds use integer quantization (Q4/Q6/Q8) and F16 projectors to fit mobile memory and bandwidth limits.',
  ),
];

export function guideFlowLabels(flowEntry: Pick<GuideFlowEntry | GuideNotSupportedEntry, 'labels'>): string[] {
  return [...flowEntry.labels];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s.-]+/g, ' ')
      .split(/\s+/)
      .filter(token => token.length >= 2),
  );
}

function renderFlowSteps(entry: GuideFlowEntry): string {
  return [`**${entry.title}**`, '', ...entry.steps].join('\n');
}

export function guideStarterAnswer(
  surface: 'mobile' | 'desktop',
  question: string,
  _topics: readonly GuideTopicFacts[],
): string | null {
  const q = question.trim().toLowerCase();
  if (!q) return null;

  if (surface === 'mobile') {
    if (q.includes('pro') && q.includes('add')) {
      return [
        'Off Grid AI Pro adds encrypted peer-to-peer sync between your phone and computer, shared clipboard, notes, private vault, voice playback, video studio, and Pro tools.',
        '',
        '[[topic:phone-sync]][[topic:phone-notes]][[topic:phone-vault]][[topic:phone-clipboard]][[topic:phone-voice]][[topic:phone-tools]]',
      ].join('\n');
    }
    if (q.includes('offline')) {
      return [
        'Once a model is downloaded, this phone chats, answers from your photos, searches your documents, transcribes speech, and generates pictures completely offline.',
        '',
        '[[topic:phone-chat]][[topic:phone-vision]][[topic:phone-documents]][[topic:phone-speech]][[topic:phone-images]]',
      ].join('\n');
    }
    if (q.includes('download') && q.includes('model')) {
      return [
        'Open **Models** to install recommended picks sized to your phone RAM, search Hugging Face, or import a local GGUF/LiteRT file.',
        '',
        '[[topic:phone-models]]',
      ].join('\n');
    }
    if (q.includes('voice')) {
      return [
        'Tap the mic to dictate locally using Whisper or Qwen3-ASR, and tap Speak on replies or enable Voice playback.',
        '',
        '[[topic:phone-speech]][[topic:phone-voice]]',
      ].join('\n');
    }
  }

  return null;
}

export function guideFlowAnswerById(
  surface: 'mobile' | 'desktop',
  flowId: string,
  _topics: readonly GuideTopicFacts[],
): string | null {
  const entry = GUIDE_FLOWS.find(f => f.id === flowId && (f.surface === surface || f.surface === 'cross'));
  if (entry) return renderFlowSteps(entry);
  const blocked = GUIDE_NOT_SUPPORTED.find(f => f.id === flowId && (f.surface === surface || f.surface === 'cross'));
  return blocked ? `**${blocked.title}**\n\n${blocked.reason}` : null;
}

export function guideFlowAnswer(
  surface: 'mobile' | 'desktop',
  question: string,
  _topics: readonly GuideTopicFacts[],
  options?: { platform?: 'android' | 'ios'; vector?: number[] },
): string | null {
  const tokens = tokenize(question);
  if (tokens.size === 0) return null;

  const isHowTo = /^(?:how|where|can\s+i|turn|enable|disable|change|open|find|delete|reset|scan|import|download|add|set)\b/i.test(
    question.trim(),
  );
  if (!isHowTo && tokens.size > 6) return null;

  const platform = options?.platform;
  const scoredFlows = GUIDE_FLOWS.filter(
    f => (f.surface === surface || f.surface === 'cross') && (!f.platform || !platform || f.platform === platform),
  )
    .map(f => {
      let score = 0;
      for (const kw of f.keywords) {
        if (tokens.has(kw.toLowerCase())) score += 2;
      }
      const titleTokens = tokenize(f.title);
      for (const t of titleTokens) {
        if (tokens.has(t)) score += 1;
      }
      return { f, score };
    })
    .filter(item => item.score >= 3)
    .sort((a, b) => b.score - a.score);

  if (scoredFlows.length > 0) {
    const top = scoredFlows[0];
    const second = scoredFlows[1];
    if (second && second.score === top.score && scoredFlows.length >= 2) {
      const picks = scoredFlows
        .slice(0, 3)
        .map(s => `[[pick:${s.f.id}|${s.f.title}]]`)
        .join('');
      return `Which of these did you mean?\n\n${picks}`;
    }
    return renderFlowSteps(top.f);
  }

  const scoredBlocked = GUIDE_NOT_SUPPORTED.filter(
    f => f.surface === surface || f.surface === 'cross',
  )
    .map(f => {
      let score = 0;
      for (const kw of f.keywords) {
        if (tokens.has(kw.toLowerCase())) score += 2;
      }
      return { f, score };
    })
    .filter(item => item.score >= 4)
    .sort((a, b) => b.score - a.score);

  if (scoredBlocked.length > 0) {
    const item = scoredBlocked[0].f;
    return `**${item.title}**\n\n${item.reason}`;
  }

  return null;
}

export function guideGrounding(
  _surface: 'mobile' | 'desktop',
  topics: readonly GuideTopicFacts[],
  history: readonly { role: 'user' | 'assistant'; content: string }[],
  _options?: { platform?: 'android' | 'ios'; vector?: number[] },
): string {
  const lastQuestion = [...history].reverse().find(t => t.role === 'user')?.content ?? '';
  const qTokens = tokenize(lastQuestion);

  const ranked = [...topics]
    .map(t => {
      let score = 0;
      const bag = tokenize(`${t.label} ${t.tagline} ${t.description} ${t.highlights.join(' ')}`);
      for (const tok of qTokens) {
        if (bag.has(tok)) score += 1;
      }
      return { t, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(x => x.t);

  const lines = [
    'You are the concise built-in assistant guide for Off Grid AI on this phone.',
    'Answer ONLY using these verified app capabilities and mention relevant cards with [[topic:<id>]]:',
    '',
    ...ranked.map(
      t =>
        `- ${t.id} (${t.label}${t.pro ? ', Pro' : ''}): ${t.tagline} ${t.highlights.join('; ')}`,
    ),
  ];
  return lines.join('\n');
}

export function guideTurnsToSend(
  history: readonly { role: 'user' | 'assistant'; content: string }[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return history
    .filter(t => typeof t.content === 'string' && t.content.trim().length > 0)
    .slice(-8)
    .map(t => ({ role: t.role, content: t.content }));
}
