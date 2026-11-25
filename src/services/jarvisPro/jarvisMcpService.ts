import type { JarvisMcpServerConfig, JarvisMcpToolEntry } from '../../stores/jarvisProStore';
import { useJarvisProStore } from '../../stores/jarvisProStore';
import { registerToolExtension, type ToolExtension } from '../tools/extensions';
import type { ToolCall, ToolResult } from '../tools/types';
import { generateId } from '../../utils/generateId';

const MCP_REQUEST_TIMEOUT_MS = 15_000;
const MCP_TOOL_SEPARATOR = '__';

export function validateMcpServerUrl(raw: string): string {
  const trimmed = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Некорректный URL сервера MCP.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Поддерживаются только протоколы http:// и https://.');
  }
  return parsed.toString();
}

async function postJsonRpc(
  endpointUrl: string,
  method: string,
  params: Record<string, unknown> = {},
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MCP_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} от MCP-сервера`);
    }
    const payload = await response.json();
    if (payload?.error) {
      throw new Error(payload.error.message || 'MCP JSON-RPC ошибка');
    }
    return payload?.result ?? payload;
  } finally {
    clearTimeout(timer);
  }
}

export async function refreshMcpServerTools(serverId: string): Promise<JarvisMcpToolEntry[]> {
  const server = useJarvisProStore.getState().mcpServers.find(s => s.id === serverId);
  if (!server) {
    throw new Error('MCP-сервер не найден.');
  }
  try {
    const result = await postJsonRpc(server.url, 'tools/list', {});
    const rawTools = Array.isArray(result?.tools) ? result.tools : [];
    const existingEnabled = new Map(server.tools.map(t => [t.name, t.enabled]));
    const parsed: JarvisMcpToolEntry[] = rawTools
      .filter((t: any) => t && typeof t.name === 'string' && t.name.trim().length > 0)
      .map((t: any) => ({
        name: String(t.name).trim(),
        description: typeof t.description === 'string' ? t.description : '',
        inputSchema:
          t.inputSchema && typeof t.inputSchema === 'object' ? t.inputSchema : undefined,
        enabled: existingEnabled.get(String(t.name).trim()) ?? true,
      }));
    useJarvisProStore.getState().setMcpServerTools(serverId, parsed, null);
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    useJarvisProStore.getState().setMcpServerTools(serverId, server.tools, msg);
    throw err;
  }
}

export async function addMcpServer(name: string, url: string): Promise<JarvisMcpServerConfig> {
  const normalizedUrl = validateMcpServerUrl(url);
  const server: JarvisMcpServerConfig = {
    id: generateId(),
    name: name.trim() || normalizedUrl,
    url: normalizedUrl,
    enabled: true,
    tools: [],
    lastError: null,
  };
  useJarvisProStore.getState().upsertMcpServer(server);
  try {
    await refreshMcpServerTools(server.id);
  } catch {
    // Store records lastError so the UI displays it clearly while keeping the server config.
  }
  return useJarvisProStore.getState().mcpServers.find(s => s.id === server.id) ?? server;
}

function getEnabledMcpToolDescriptors() {
  const servers = useJarvisProStore.getState().mcpServers;
  const list: Array<{
    fullName: string;
    toolName: string;
    server: JarvisMcpServerConfig;
    tool: JarvisMcpToolEntry;
  }> = [];
  for (const server of servers) {
    if (!server.enabled) continue;
    for (const tool of server.tools) {
      if (!tool.enabled) continue;
      list.push({
        fullName: `mcp_${server.id.slice(0, 6)}${MCP_TOOL_SEPARATOR}${tool.name}`,
        toolName: tool.name,
        server,
        tool,
      });
    }
  }
  return list;
}

export function createJarvisMcpToolExtension(): ToolExtension {
  return {
    id: 'jarvis-open-mcp',
    getSystemPromptHint(): string {
      const enabled = getEnabledMcpToolDescriptors();
      if (enabled.length === 0) return '';
      return `Пользовательские инструменты MCP доступны: ${enabled.map(d => d.fullName).join(', ')}.`;
    },
    getOpenAISchemas() {
      return getEnabledMcpToolDescriptors().map(d => ({
        type: 'function' as const,
        function: {
          name: d.fullName,
          description: d.tool.description || `MCP tool ${d.toolName}`,
          parameters: d.tool.inputSchema ?? { type: 'object', properties: {} },
        },
      }));
    },
    parseToolCalls(): ToolCall[] {
      return [];
    },
    stripFromVisibleText(text: string): string {
      return text;
    },
    canHandle(toolName: string): boolean {
      return getEnabledMcpToolDescriptors().some(d => d.fullName === toolName);
    },
    async execute(call: ToolCall): Promise<ToolResult> {
      const started = Date.now();
      const target = getEnabledMcpToolDescriptors().find(d => d.fullName === call.name);
      if (!target) {
        return {
          toolCallId: call.id,
          name: call.name,
          content: '',
          error: `Инструмент MCP не активен или не разрешён: ${call.name}`,
          durationMs: Date.now() - started,
        };
      }
      try {
        const result = await postJsonRpc(target.server.url, 'tools/call', {
          name: target.toolName,
          arguments: call.arguments ?? {},
        });
        const content =
          typeof result === 'string'
            ? result
            : Array.isArray(result?.content)
              ? result.content
                  .map((c: any) => (typeof c?.text === 'string' ? c.text : JSON.stringify(c)))
                  .join('\n')
              : JSON.stringify(result);
        return {
          toolCallId: call.id,
          name: call.name,
          content,
          durationMs: Date.now() - started,
        };
      } catch (err) {
        return {
          toolCallId: call.id,
          name: call.name,
          content: '',
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - started,
        };
      }
    },
    enabledToolCount(): number {
      return getEnabledMcpToolDescriptors().length;
    },
    subscribe(listener: () => void): () => void {
      return useJarvisProStore.subscribe(() => listener());
    },
  };
}

export function registerJarvisMcpExtension(): () => void {
  return registerToolExtension(createJarvisMcpToolExtension());
}
