import { NativeModules, Platform } from 'react-native';
import {
  registerToolExtension,
  type ToolExtension,
} from '../tools/extensions';
import type { ToolCall, ToolResult } from '../tools/types';

interface NativePhoneActionsModule {
  setTimer(seconds: number, label: string | null): Promise<{ ok: boolean; seconds: number }>;
  setAlarm(hour: number, minute: number, label: string | null): Promise<{ ok: boolean; hour: number; minute: number }>;
  setFlashlight(enabled: boolean): Promise<{ ok: boolean; enabled: boolean }>;
  openSystemSettings(section: string): Promise<{ ok: boolean; section: string }>;
  openUrl(url: string): Promise<{ ok: boolean; url: string }>;
  shareText(text: string, title: string | null): Promise<{ ok: boolean }>;
}

const ALLOWED_SETTINGS_SECTIONS = new Set([
  'wifi',
  'bluetooth',
  'sound',
  'display',
  'battery',
  'app',
  'main',
]);

const ACTION_TOOL_NAMES = new Set([
  'set_timer',
  'set_alarm',
  'toggle_flashlight',
  'open_settings',
  'open_url',
  'share_text',
]);

function getNativeActionsModule(): NativePhoneActionsModule | null {
  if (Platform.OS !== 'android') return null;
  const mod = NativeModules.JarvisPhoneActionsModule as NativePhoneActionsModule | undefined;
  return mod && typeof mod.setTimer === 'function' ? mod : null;
}

function failResult(call: ToolCall, started: number, error: string): ToolResult {
  return {
    toolCallId: call.id,
    name: call.name,
    content: '',
    error,
    durationMs: Date.now() - started,
  };
}

function okResult(call: ToolCall, started: number, content: string): ToolResult {
  return {
    toolCallId: call.id,
    name: call.name,
    content,
    durationMs: Date.now() - started,
  };
}

type PhoneActionArgs = Record<string, unknown>;
type PhoneActionHandler = (
  call: ToolCall,
  started: number,
  mod: NativePhoneActionsModule,
  args: PhoneActionArgs,
) => Promise<ToolResult>;

function optionalTrimmedString(args: PhoneActionArgs, key: string): string | null {
  const value = args[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

async function executeSetTimer(
  call: ToolCall,
  started: number,
  mod: NativePhoneActionsModule,
  args: PhoneActionArgs,
): Promise<ToolResult> {
  const seconds = Number(args.seconds);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 86_400) {
    return failResult(call, started, 'Укажите целое число секунд от 1 до 86400.');
  }
  await mod.setTimer(seconds, optionalTrimmedString(args, 'label'));
  return okResult(call, started, `Открыт системный таймер на ${seconds} сек.`);
}

async function executeSetAlarm(
  call: ToolCall,
  started: number,
  mod: NativePhoneActionsModule,
  args: PhoneActionArgs,
): Promise<ToolResult> {
  const hour = Number(args.hour);
  const minute = Number(args.minute);
  const validHour = Number.isInteger(hour) && hour >= 0 && hour <= 23;
  const validMinute = Number.isInteger(minute) && minute >= 0 && minute <= 59;
  if (!validHour || !validMinute) {
    return failResult(call, started, 'Некорректное время будильника (часы 0–23, минуты 0–59).');
  }
  await mod.setAlarm(hour, minute, optionalTrimmedString(args, 'label'));
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return okResult(call, started, `Открыт системный будильник на ${hh}:${mm}.`);
}

async function executeToggleFlashlight(
  call: ToolCall,
  started: number,
  mod: NativePhoneActionsModule,
  args: PhoneActionArgs,
): Promise<ToolResult> {
  if (typeof args.enabled !== 'boolean') {
    return failResult(call, started, 'Параметр enabled должен быть true или false.');
  }
  await mod.setFlashlight(args.enabled);
  return okResult(call, started, args.enabled ? 'Фонарик включён.' : 'Фонарик выключен.');
}

async function executeOpenSettings(
  call: ToolCall,
  started: number,
  mod: NativePhoneActionsModule,
  args: PhoneActionArgs,
): Promise<ToolResult> {
  const section = typeof args.section === 'string' ? args.section.trim().toLowerCase() : '';
  if (!ALLOWED_SETTINGS_SECTIONS.has(section)) {
    return failResult(
      call,
      started,
      'Недопустимый раздел настроек. Разрешены: wifi, bluetooth, sound, display, battery, app, main.',
    );
  }
  await mod.openSystemSettings(section);
  return okResult(call, started, `Открыты настройки: ${section}.`);
}

async function executeOpenUrl(
  call: ToolCall,
  started: number,
  mod: NativePhoneActionsModule,
  args: PhoneActionArgs,
): Promise<ToolResult> {
  const url = typeof args.url === 'string' ? args.url.trim() : '';
  if (!/^https?:\/\/[^\s/$.?#]\S*$/i.test(url)) {
    return failResult(call, started, 'Разрешены только корректные адреса http:// и https://.');
  }
  await mod.openUrl(url);
  return okResult(call, started, `Ссылка открыта в браузере: ${url}`);
}

async function executeShareText(
  call: ToolCall,
  started: number,
  mod: NativePhoneActionsModule,
  args: PhoneActionArgs,
): Promise<ToolResult> {
  const text = optionalTrimmedString(args, 'text');
  if (!text) {
    return failResult(call, started, 'Укажите непустой текст для отправки.');
  }
  await mod.shareText(text, optionalTrimmedString(args, 'title'));
  return okResult(call, started, 'Открыто меню «Поделиться».');
}

const ACTION_HANDLERS: Record<string, PhoneActionHandler> = {
  set_timer: executeSetTimer,
  set_alarm: executeSetAlarm,
  toggle_flashlight: executeToggleFlashlight,
  open_settings: executeOpenSettings,
  open_url: executeOpenUrl,
  share_text: executeShareText,
};

export function createJarvisPhoneActionsExtension(): ToolExtension {
  return {
    id: 'jarvis-phone-actions',
    getSystemPromptHint(): string {
      if (!getNativeActionsModule()) return '';
      return [
        'Инструменты действий на телефоне Android (выполняй только по прямой просьбе пользователя):',
        '- set_timer(seconds, label?): поставить таймер (1..86400 сек).',
        '- set_alarm(hour, minute, label?): поставить будильник (0..23 и 0..59).',
        '- toggle_flashlight(enabled): включить или выключить фонарик.',
        '- open_settings(section): открыть настройки (wifi, bluetooth, sound, display, battery, app, main).',
        '- open_url(url): открыть http:// или https:// ссылку в браузере.',
        '- share_text(text, title?): открыть системное меню «Поделиться» с текстом.',
      ].join('\n');
    },
    getOpenAISchemas() {
      if (!getNativeActionsModule()) return [];
      return [
        {
          type: 'function' as const,
          function: {
            name: 'set_timer',
            description: 'Set a countdown timer on Android with OS clock confirmation.',
            parameters: {
              type: 'object',
              properties: {
                seconds: { type: 'number', description: 'Duration in seconds (1..86400).' },
                label: { type: 'string', description: 'Optional short timer label.' },
              },
              required: ['seconds'],
            },
          },
        },
        {
          type: 'function' as const,
          function: {
            name: 'set_alarm',
            description: 'Set an alarm on Android at hour (0..23) and minute (0..59).',
            parameters: {
              type: 'object',
              properties: {
                hour: { type: 'number', description: 'Hour (0..23).' },
                minute: { type: 'number', description: 'Minute (0..59).' },
                label: { type: 'string', description: 'Optional alarm label.' },
              },
              required: ['hour', 'minute'],
            },
          },
        },
        {
          type: 'function' as const,
          function: {
            name: 'toggle_flashlight',
            description: 'Turn Android rear camera flashlight on or off.',
            parameters: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean', description: 'true to turn on, false to turn off.' },
              },
              required: ['enabled'],
            },
          },
        },
        {
          type: 'function' as const,
          function: {
            name: 'open_settings',
            description: 'Open an Android system settings screen from the allowlist.',
            parameters: {
              type: 'object',
              properties: {
                section: {
                  type: 'string',
                  description: 'One of: wifi, bluetooth, sound, display, battery, app, main.',
                },
              },
              required: ['section'],
            },
          },
        },
        {
          type: 'function' as const,
          function: {
            name: 'open_url',
            description: 'Open an http:// or https:// URL in the Android browser.',
            parameters: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'Full http:// or https:// URL.' },
              },
              required: ['url'],
            },
          },
        },
        {
          type: 'function' as const,
          function: {
            name: 'share_text',
            description: 'Open the Android share sheet with plain text.',
            parameters: {
              type: 'object',
              properties: {
                text: { type: 'string', description: 'Text content to share.' },
                title: { type: 'string', description: 'Optional chooser title.' },
              },
              required: ['text'],
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
      return ACTION_TOOL_NAMES.has(toolName) && getNativeActionsModule() !== null;
    },
    async execute(call: ToolCall): Promise<ToolResult> {
      const started = Date.now();
      const mod = getNativeActionsModule();
      if (!mod) {
        return failResult(call, started, 'Нативные действия телефона недоступны на этом устройстве.');
      }

      const handler = ACTION_HANDLERS[call.name];
      if (!handler) {
        return failResult(call, started, `Неизвестное действие телефона: ${call.name}`);
      }
      try {
        return await handler(call, started, mod, call.arguments ?? {});
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return failResult(call, started, message);
      }
    },
    enabledToolCount(): number {
      return getNativeActionsModule() ? ACTION_TOOL_NAMES.size : 0;
    },
  };
}

export function registerJarvisPhoneActionsExtension(): () => void {
  return registerToolExtension(createJarvisPhoneActionsExtension());
}
