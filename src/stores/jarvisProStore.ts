import { create } from 'zustand';

export interface JarvisMcpToolEntry {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  enabled: boolean;
}

export interface JarvisMcpServerConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  tools: JarvisMcpToolEntry[];
  lastError?: string | null;
}

export type JarvisVideoBackend = 'auto' | 'cpu' | 'gpu';

export interface JarvisProState {
  ttsAutoSpeak: boolean;
  ttsRate: number;
  ttsVoiceId: string | null;
  ttsSpeakingMessageId: string | null;

  selectedVideoPackId: string | null;
  downloadedVideoPackIds: string[];
  videoDownloadingPackId: string | null;
  videoDownloadProgress: number;
  videoGenerating: boolean;
  videoStage: string | null;
  videoStep: number;
  videoTotalSteps: number;
  videoError: string | null;
  videoBackend: JarvisVideoBackend;

  mcpServers: JarvisMcpServerConfig[];

  setTtsAutoSpeak: (enabled: boolean) => void;
  setTtsRate: (rate: number) => void;
  setTtsVoiceId: (voiceId: string | null) => void;
  setTtsSpeakingMessageId: (messageId: string | null) => void;

  setSelectedVideoPackId: (packId: string | null) => void;
  setDownloadedVideoPackIds: (packIds: string[]) => void;
  setVideoDownloadState: (
    patch: Partial<Pick<JarvisProState, 'videoDownloadingPackId' | 'videoDownloadProgress'>>,
  ) => void;
  setVideoRunState: (
    patch: Partial<
      Pick<
        JarvisProState,
        'videoGenerating' | 'videoStage' | 'videoStep' | 'videoTotalSteps' | 'videoError'
      >
    >,
  ) => void;
  setVideoBackend: (backend: JarvisVideoBackend) => void;

  upsertMcpServer: (server: JarvisMcpServerConfig) => void;
  removeMcpServer: (serverId: string) => void;
  toggleMcpServerEnabled: (serverId: string, enabled: boolean) => void;
  toggleMcpToolEnabled: (serverId: string, toolName: string, enabled: boolean) => void;
  setMcpServerTools: (
    serverId: string,
    tools: JarvisMcpToolEntry[],
    error?: string | null,
  ) => void;
}

export const useJarvisProStore = create<JarvisProState>(set => ({
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

  setTtsAutoSpeak: enabled => set({ ttsAutoSpeak: enabled }),
  setTtsRate: rate => {
    const clamped = Number.isFinite(rate) ? Math.min(2.0, Math.max(0.5, rate)) : 1.0;
    set({ ttsRate: clamped });
  },
  setTtsVoiceId: voiceId => set({ ttsVoiceId: voiceId }),
  setTtsSpeakingMessageId: messageId => set({ ttsSpeakingMessageId: messageId }),

  setSelectedVideoPackId: packId => set({ selectedVideoPackId: packId }),
  setDownloadedVideoPackIds: packIds => set({ downloadedVideoPackIds: packIds }),
  setVideoDownloadState: patch => set(patch),
  setVideoRunState: patch => set(patch),
  setVideoBackend: backend => set({ videoBackend: backend }),

  upsertMcpServer: server =>
    set(state => {
      const idx = state.mcpServers.findIndex(s => s.id === server.id);
      if (idx === -1) return { mcpServers: [...state.mcpServers, server] };
      const next = [...state.mcpServers];
      next[idx] = server;
      return { mcpServers: next };
    }),
  removeMcpServer: serverId =>
    set(state => ({
      mcpServers: state.mcpServers.filter(s => s.id !== serverId),
    })),
  toggleMcpServerEnabled: (serverId, enabled) =>
    set(state => ({
      mcpServers: state.mcpServers.map(s =>
        s.id === serverId ? { ...s, enabled } : s,
      ),
    })),
  toggleMcpToolEnabled: (serverId, toolName, enabled) =>
    set(state => ({
      mcpServers: state.mcpServers.map(s =>
        s.id === serverId
          ? {
              ...s,
              tools: s.tools.map(t => (t.name === toolName ? { ...t, enabled } : t)),
            }
          : s,
      ),
    })),
  setMcpServerTools: (serverId, tools, error = null) =>
    set(state => ({
      mcpServers: state.mcpServers.map(s =>
        s.id === serverId ? { ...s, tools, lastError: error } : s,
      ),
    })),
}));
