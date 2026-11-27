import {
  registerToolExtension,
  type ToolExtension,
} from '../tools/extensions';
import type { ToolCall, ToolResult } from '../tools/types';
import { useAppStore } from '../../stores/appStore';
import { useRemoteServerStore } from '../../stores/remoteServerStore';
import { imageGenerationService } from '../imageGenerationService';
import { prepareMediaPromptForEngine } from './russianPromptBridge';

interface DeferredImageRequest {
  prompt: string;
  negativePrompt?: string;
}

const deferredImageRequests = new Map<string, DeferredImageRequest>();

function hasAvailableImageGenerator(): boolean {
  const { downloadedImageModels } = useAppStore.getState();
  if (downloadedImageModels.length > 0) return true;
  const remoteImage = useRemoteServerStore
    .getState()
    .getActiveRemoteMediaServer('image');
  return !!remoteImage?.mediaModels?.image;
}

export async function finishDeferredJarvisImage(
  conversationId: string,
  stopped: boolean,
): Promise<void> {
  const req = deferredImageRequests.get(conversationId);
  deferredImageRequests.delete(conversationId);
  if (!req || stopped) return;
  const preparedPrompt = prepareMediaPromptForEngine(req.prompt);
  await imageGenerationService.generateImage({
    prompt: preparedPrompt || req.prompt,
    negativePrompt: req.negativePrompt,
    conversationId,
    promptIsFinal: true,
    previewInterval: 2,
  });
}

export function discardDeferredJarvisImage(conversationId: string): void {
  deferredImageRequests.delete(conversationId);
}

export function hasPendingJarvisImage(): boolean {
  return deferredImageRequests.size > 0;
}

export function createJarvisImageToolExtension(): ToolExtension {
  return {
    id: 'jarvis-open-image',
    getSystemPromptHint(): string {
      if (!hasAvailableImageGenerator()) return '';
      return 'Инструмент генерации изображений: для рисования или создания картинок по просьбе пользователя вызывай generate_image с подробным описанием сцены на английском языке.';
    },
    getOpenAISchemas() {
      if (!hasAvailableImageGenerator()) return [];
      return [
        {
          type: 'function' as const,
          function: {
            name: 'generate_image',
            description:
              'Generate an image locally on the device after this reply finishes. Provide a clear visual description in English.',
            parameters: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description:
                    'Detailed visual image description in English (subject, scene, lighting, style).',
                },
                negative_prompt: {
                  type: 'string',
                  description: 'Optional artifacts to exclude from the image.',
                },
              },
              required: ['prompt'],
            },
          },
        },
      ];
    },
    parseToolCalls(): ToolCall[] {
      return [];
    },
    stripFromVisibleText(text: string): string {
      return text;
    },
    canHandle(toolName: string): boolean {
      return toolName === 'generate_image' && hasAvailableImageGenerator();
    },
    async execute(call: ToolCall): Promise<ToolResult> {
      const started = Date.now();
      const rawPrompt = call.arguments?.prompt;
      const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim() : '';
      const convId = call.context?.conversationId;
      if (!prompt || !convId) {
        return {
          toolCallId: call.id,
          name: call.name,
          content: '',
          error: 'Требуется описание изображения и активный чат.',
          durationMs: Date.now() - started,
        };
      }
      if (!hasAvailableImageGenerator()) {
        return {
          toolCallId: call.id,
          name: call.name,
          content: '',
          error:
            'Не скачана модель для изображений. Скачайте её во вкладке «Модели → Изображения».',
          durationMs: Date.now() - started,
        };
      }
      const rawNeg = call.arguments?.negative_prompt;
      const negativePrompt =
        typeof rawNeg === 'string' && rawNeg.trim() ? rawNeg.trim() : undefined;
      deferredImageRequests.set(convId, { prompt, negativePrompt });
      return {
        toolCallId: call.id,
        name: call.name,
        content:
          'Генерация изображения поставлена в очередь и начнётся сразу после этого ответа.',
        durationMs: Date.now() - started,
      };
    },
    enabledToolCount(): number {
      return hasAvailableImageGenerator() ? 1 : 0;
    },
    subscribe(listener: () => void): () => void {
      const unsubApp = useAppStore.subscribe(
        (next, prev) => {
          if (next.downloadedImageModels.length !== prev.downloadedImageModels.length) {
            listener();
          }
        },
      );
      const unsubRemote = useRemoteServerStore.subscribe(() => {
        listener();
      });
      return () => {
        unsubApp();
        unsubRemote();
      };
    },
  };
}

export function registerJarvisImageExtension(): () => void {
  return registerToolExtension(createJarvisImageToolExtension());
}
