import { DeviceEventEmitter, NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import type { ModelEntry } from '../../types/modelCatalog';
import { useAppStore } from '../../stores/appStore';
import { useChatStore } from '../../stores/chatStore';
import { useJarvisProStore } from '../../stores/jarvisProStore';
import { completeVideoPacks, phoneVideoSize, bestInstalledVideoModel } from '../phoneVideoPacks';
import { videoModelDirectory, videoModelsDirectory } from '../videoModelFiles';
import { videoModelDefaults } from '../../utils/videoPackPolicy';
import { generateId } from '../../utils/generateId';
import { hardwareService } from '../hardware';
import { hasCyrillic, prepareMediaPromptForEngine } from './russianPromptBridge';

interface NativeVideoModule {
  generate(input: Record<string, unknown>): Promise<{ path: string }>;
  cancel(): Promise<void>;
}

interface DeferredVideoRequest {
  prompt: string;
  film?: boolean;
  startImage?: 'last_image';
}

const deferredRequests = new Map<string, DeferredVideoRequest>();
let activeDownloadJobIds: number[] = [];
let downloadCancelled = false;

function getNativeVideoModule(): NativeVideoModule | null {
  const mod = NativeModules.VideoGenerationModule as NativeVideoModule | undefined;
  return mod && typeof mod.generate === 'function' ? mod : null;
}

function isPackFilesComplete(dir: string, entryNames: Set<string>, pack: ModelEntry): boolean {
  return pack.files.every(f => entryNames.has(f.name)) && dir.length > 0;
}

async function scanDownloadedVideoPacks(): Promise<string[]> {
  const root = videoModelsDirectory();
  try {
    const exists = await RNFS.exists(root);
    if (!exists) {
      useJarvisProStore.getState().setDownloadedVideoPackIds([]);
      return [];
    }
    const found: string[] = [];
    for (const pack of completeVideoPacks()) {
      const dir = videoModelDirectory(pack.id);
      if (!(await RNFS.exists(dir))) continue;
      const entries = await RNFS.readDir(dir);
      const nonEmpty = new Set(entries.filter(e => Number(e.size) > 0).map(e => e.name));
      if (isPackFilesComplete(dir, nonEmpty, pack)) {
        found.push(pack.id);
        const appStore = useAppStore.getState();
        if (!appStore.downloadedVideoModels.some(m => m.id === pack.id)) {
          appStore.addDownloadedVideoModel({
            ...pack,
            kind: 'video',
            downloadedAt: new Date().toISOString(),
          });
        }
      }
    }
    useJarvisProStore.getState().setDownloadedVideoPackIds(found);
    const { selectedVideoPackId, setSelectedVideoPackId } = useJarvisProStore.getState();
    if (!selectedVideoPackId && found.length > 0) {
      const installedEntries = completeVideoPacks().filter(p => found.includes(p.id));
      const best = bestInstalledVideoModel(installedEntries);
      if (best) setSelectedVideoPackId(best.id);
    }
    return found;
  } catch {
    return [];
  }
}

async function downloadVideoPack(pack: ModelEntry): Promise<void> {
  const store = useJarvisProStore.getState();
  if (store.videoDownloadingPackId) {
    throw new Error('Уже идёт загрузка другой видеомодели.');
  }
  downloadCancelled = false;
  activeDownloadJobIds = [];
  const dir = videoModelDirectory(pack.id);
  store.setVideoDownloadState({ videoDownloadingPackId: pack.id, videoDownloadProgress: 0 });
  store.setVideoRunState({ videoError: null });

  try {
    await RNFS.mkdir(dir);
    const totalExpected = pack.files.reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);
    let completedBytes = 0;

    for (const file of pack.files) {
      if (downloadCancelled) throw new Error('Загрузка видеомодели отменена.');
      const dest = `${dir}/${file.name}`;
      if (await RNFS.exists(dest)) {
        const stat = await RNFS.stat(dest);
        if (Number(stat.size) > 0 && (!file.sizeBytes || Number(stat.size) === file.sizeBytes)) {
          completedBytes += Number(stat.size);
          continue;
        }
      }
      const task = RNFS.downloadFile({
        fromUrl: file.url,
        toFile: dest,
        progressDivider: 2,
        progress: res => {
          if (downloadCancelled) return;
          const total = totalExpected || Math.max(res.contentLength, 1);
          const overall = Math.min(1, (completedBytes + res.bytesWritten) / total);
          useJarvisProStore.getState().setVideoDownloadState({ videoDownloadProgress: overall });
        },
      });
      activeDownloadJobIds.push(task.jobId);
      const outcome = await task.promise;
      if (downloadCancelled) throw new Error('Загрузка видеомодели отменена.');
      if (outcome.statusCode < 200 || outcome.statusCode >= 300) {
        throw new Error(`Не удалось скачать ${file.name}: HTTP ${outcome.statusCode}`);
      }
      completedBytes += file.sizeBytes ?? outcome.bytesWritten ?? 0;
    }

    await scanDownloadedVideoPacks();
    useJarvisProStore.getState().setSelectedVideoPackId(pack.id);
    useAppStore.getState().setActiveVideoModelId(pack.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    useJarvisProStore.getState().setVideoRunState({ videoError: message });
    throw err;
  } finally {
    activeDownloadJobIds = [];
    useJarvisProStore.getState().setVideoDownloadState({
      videoDownloadingPackId: null,
      videoDownloadProgress: 0,
    });
  }
}

function cancelVideoDownload(): void {
  downloadCancelled = true;
  for (const jobId of activeDownloadJobIds) {
    try {
      RNFS.stopDownload(jobId);
    } catch {
      // Ignore already finished job.
    }
  }
  activeDownloadJobIds = [];
  useJarvisProStore.getState().setVideoDownloadState({
    videoDownloadingPackId: null,
    videoDownloadProgress: 0,
  });
}

async function deleteVideoPack(packId: string): Promise<void> {
  const dir = videoModelDirectory(packId);
  if (await RNFS.exists(dir)) {
    await RNFS.unlink(dir);
  }
  useAppStore.getState().removeDownloadedVideoModel(packId);
  const current = useJarvisProStore.getState().selectedVideoPackId;
  if (current === packId) {
    useJarvisProStore.getState().setSelectedVideoPackId(null);
  }
  await scanDownloadedVideoPacks();
}

function resolvePackFilePaths(pack: ModelEntry): {
  weight: string;
  vae: string;
  encoder: string;
} {
  const dir = videoModelDirectory(pack.id);
  const primary = pack.files.find(f => f.role === 'primary') ?? pack.files[0];
  const vae = pack.files.find(f => /vae/i.test(f.name) && f.name !== primary.name);
  const encoder = pack.files.find(f => /(umt5|t5|clip|encoder)/i.test(f.name));
  if (!primary || !vae) {
    throw new Error('В выбранном видеопаке не найдены обязательные файлы весов или VAE.');
  }
  return {
    weight: `${dir}/${primary.name}`,
    vae: `${dir}/${vae.name}`,
    encoder: encoder ? `${dir}/${encoder.name}` : '',
  };
}

async function generateVideo(input: {
  prompt: string;
  conversationId?: string;
  initImagePath?: string;
  styleId?: string;
}): Promise<{ path: string }> {
  const native = getNativeVideoModule();
  if (!native) {
    throw new Error('Нативный видеодвижок недоступен на этом устройстве.');
  }
  const installedIds = await scanDownloadedVideoPacks();
  const state = useJarvisProStore.getState();
  const chosenId =
    state.selectedVideoPackId && installedIds.includes(state.selectedVideoPackId)
      ? state.selectedVideoPackId
      : installedIds[0];
  const pack = completeVideoPacks().find(p => p.id === chosenId);
  if (!pack) {
    throw new Error('Сначала скачайте видеомодель в разделе «Модели → Видео».');
  }

  const paths = resolvePackFilePaths(pack);
  const defaults = videoModelDefaults(paths.weight);
  const ramGB = hardwareService.getTotalMemoryGB();
  const sized = phoneVideoSize(paths.weight, ramGB);
  const width = sized?.width ?? defaults.width;
  const height = sized?.height ?? defaults.height;
  const steps = defaults.steps;
  const frames = defaults.frames;
  const fps = defaults.fps;
  const guidance = defaults.guidance;
  const seed = Math.floor(Math.random() * 2_000_000_000);

  const outDir = `${RNFS.DocumentDirectoryPath}/generated-videos`;
  await RNFS.mkdir(outDir);
  const id = generateId();
  const fileName = `jarvis-vid-${id}.mp4`;
  const outputPath = `${outDir}/${fileName}`;

  const translatedPrompt = hasCyrillic(input.prompt)
    ? prepareMediaPromptForEngine(input.prompt)
    : input.prompt;
  const promptText = input.styleId
    ? `${translatedPrompt}, ${input.styleId}`
    : translatedPrompt;
  const progressSub =
    typeof DeviceEventEmitter?.addListener === 'function'
      ? DeviceEventEmitter.addListener(
          'VideoGenerationProgress',
          (ev: { stage?: string; step?: number; total?: number } | undefined) => {
            useJarvisProStore.getState().setVideoRunState({
              videoStage: ev?.stage ?? 'generating',
              videoStep: ev?.step ?? 0,
              videoTotalSteps: ev?.total ?? steps,
            });
          },
        )
      : null;

  useJarvisProStore.getState().setVideoRunState({
    videoGenerating: true,
    videoStage: 'preparing',
    videoStep: 0,
    videoTotalSteps: steps,
    videoError: null,
  });

  try {
    const res = await native.generate({
      weight: paths.weight,
      vae: paths.vae,
      encoder: paths.encoder,
      prompt: promptText,
      negativePrompt: '',
      width,
      height,
      frames,
      fps,
      steps,
      guidance,
      seed,
      flowShift: 5.0,
      backend: useJarvisProStore.getState().videoBackend,
      outputPath,
      ...(input.initImagePath ? { initImage: input.initImagePath } : {}),
    });

    const finalPath = res?.path || outputPath;
    useAppStore.getState().addGeneratedVideo({
      id,
      prompt: input.prompt,
      videoPath: finalPath,
      fileName,
      width,
      height,
      fps,
      frames,
      durationSeconds: Number((frames / Math.max(1, fps)).toFixed(2)),
      steps,
      guidance,
      seed,
      modelId: pack.id,
      createdAt: new Date().toISOString(),
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    });

    if (input.conversationId) {
      useChatStore.getState().addMessage(input.conversationId, {
        role: 'assistant',
        content: `Видео сгенерировано: ${input.prompt}`,
        attachments: [{ id, type: 'video', uri: finalPath, fileName }],
      });
    }
    return { path: finalPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    useJarvisProStore.getState().setVideoRunState({ videoError: message });
    throw err;
  } finally {
    progressSub?.remove?.();
    useJarvisProStore.getState().setVideoRunState({
      videoGenerating: false,
      videoStage: null,
      videoStep: 0,
      videoTotalSteps: 0,
    });
  }
}

function isBusy(): boolean {
  return useJarvisProStore.getState().videoGenerating;
}

function hasPending(): boolean {
  return deferredRequests.size > 0 || isBusy();
}

async function cancel(): Promise<void> {
  deferredRequests.clear();
  const native = getNativeVideoModule();
  if (!native) return;
  try {
    await native.cancel();
  } catch {
    // Ignore native cancel failures when idle.
  }
}

function defer(conversationId: string, input: DeferredVideoRequest): void {
  deferredRequests.set(conversationId, input);
}

async function finishDeferred(conversationId: string, stopped: boolean): Promise<void> {
  const req = deferredRequests.get(conversationId);
  deferredRequests.delete(conversationId);
  if (!req || stopped) return;
  let initImagePath: string | undefined;
  if (req.startImage === 'last_image') {
    const images = useAppStore.getState().generatedImages;
    const convMatch = [...images].reverse().find(img => img.conversationId === conversationId);
    initImagePath = (convMatch ?? images[images.length - 1])?.imagePath;
  }
  await generateVideo({
    prompt: req.prompt,
    conversationId,
    ...(initImagePath ? { initImagePath } : {}),
  });
}

function discardDeferred(conversationId: string): void {
  deferredRequests.delete(conversationId);
}

export const jarvisVideoService = {
  scanDownloadedVideoPacks,
  downloadVideoPack,
  cancelVideoDownload,
  deleteVideoPack,
  generateVideo,
  isBusy,
  hasPending,
  cancel,
  defer,
  finishDeferred,
  discardDeferred,
};
