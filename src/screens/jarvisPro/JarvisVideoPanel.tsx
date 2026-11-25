import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';
import { TouchableOpacity } from '../../components/Touchable';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { SCROLL_DEPTH_PROPS } from '../../constants/scrollDepth';
import type { RootStackParamList } from '../../navigation/types';
import { hardwareService } from '../../services/hardware';
import { jarvisVideoService } from '../../services/jarvisPro/jarvisVideoService';
import {
  completeVideoPacks,
  videoPacksForPhone,
} from '../../services/phoneVideoPacks';
import { useJarvisProStore } from '../../stores';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { cardSurface } from '../../theme/surface';
import type { ModelEntry } from '../../types/modelCatalog';
import { formatBytes } from '../../utils/formatBytes';

export interface JarvisVideoPanelProps {
  selected?: unknown;
  setSelected?: (model: any) => void;
  onSelect?: () => void;
}

const createStyles = (colors: ThemeColors) => ({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  card: {
    ...cardSurface(colors),
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  rowBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.sm,
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: colors.text,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: colors.text,
  },
  body: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.textSecondary,
  },
  meta: {
    ...TYPOGRAPHY.meta,
    color: colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 72,
    textAlignVertical: 'top' as const,
  },
  actionsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.sm,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.onPrimary,
  },
  secondaryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.text,
  },
  dangerButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorBackground,
  },
  dangerButtonText: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.error,
  },
  errorBox: {
    padding: SPACING.sm,
    borderRadius: 8,
    backgroundColor: colors.errorBackground,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.error,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceLight,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.primary,
  },
  packCard: {
    ...cardSurface(colors),
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  packCardSelected: {
    borderColor: colors.primary,
  },
});

function packSizeBytes(pack: ModelEntry): number {
  return pack.files.reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);
}

export const JarvisVideoPanel: React.FC<JarvisVideoPanelProps> = ({
  selected: _selected,
  setSelected: _setSelected,
  onSelect,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const downloadedIds = useJarvisProStore(s => s.downloadedVideoPackIds);
  const selectedId = useJarvisProStore(s => s.selectedVideoPackId);
  const downloadingPackId = useJarvisProStore(s => s.videoDownloadingPackId);
  const downloadProgress = useJarvisProStore(s => s.videoDownloadProgress);
  const videoGenerating = useJarvisProStore(s => s.videoGenerating);
  const videoStage = useJarvisProStore(s => s.videoStage);
  const videoStep = useJarvisProStore(s => s.videoStep);
  const videoTotalSteps = useJarvisProStore(s => s.videoTotalSteps);
  const videoError = useJarvisProStore(s => s.videoError);
  const setSelectedVideoPackId = useJarvisProStore(s => s.setSelectedVideoPackId);
  const setVideoRunState = useJarvisProStore(s => s.setVideoRunState);

  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    jarvisVideoService.scanDownloadedVideoPacks().catch(() => {});
  }, []);

  const ramGB = hardwareService.getTotalMemoryGB();
  const phonePacks = videoPacksForPhone(ramGB);
  const packs = phonePacks.length > 0 ? phonePacks : completeVideoPacks();

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setVideoRunState({ videoError: 'Введите описание сцены для генерации видео.' });
      return;
    }
    try {
      await jarvisVideoService.generateVideo({ prompt: cleanPrompt });
    } catch {
      // Error is stored in videoError and rendered cleanly below.
    }
  };

  const handleCancelGenerate = () => {
    jarvisVideoService.cancel().catch(() => {});
  };

  const progressRatio =
    videoTotalSteps > 0 ? Math.min(1, videoStep / videoTotalSteps) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      {...SCROLL_DEPTH_PROPS}
      testID="jarvis-video-panel"
    >
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.titleRow}>
            <Icon name="film" size={18} color={colors.primary} />
            <Text style={styles.title}>Локальное видео (Wan 2.1)</Text>
          </View>
          <TouchableOpacity
            testID="jarvis-video-open-gallery"
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Gallery')}
          >
            <Icon name="image" size={14} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Галерея</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.body}>
          Создание коротких видеороликов прямо на телефоне. Доступная память:{' '}
          {ramGB.toFixed(1)} ГБ ОЗУ.
        </Text>

        <TextInput
          testID="jarvis-video-prompt-input"
          style={styles.input}
          placeholder="Опишите видео на русском или английском (например: космический корабль над океаном)"
          placeholderTextColor={colors.textMuted}
          multiline
          value={prompt}
          onChangeText={setPrompt}
        />

        {videoGenerating && (
          <View>
            <Text style={styles.meta}>
              {`Этап: ${videoStage ?? 'генерация'} · шаг ${videoStep} из ${videoTotalSteps}`}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${Math.round(progressRatio * 100)}%` }]}
              />
            </View>
          </View>
        )}

        {!!videoError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{videoError}</Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          {videoGenerating ? (
            <TouchableOpacity
              testID="jarvis-video-cancel-button"
              style={styles.dangerButton}
              onPress={handleCancelGenerate}
            >
              <Icon name="x" size={15} color={colors.error} />
              <Text style={styles.dangerButtonText}>Остановить</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="jarvis-video-generate-button"
              style={styles.primaryButton}
              onPress={handleGenerate}
            >
              <Icon name="video" size={15} color={colors.onPrimary} />
              <Text style={styles.primaryButtonText}>Создать видео</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Видеомодели для скачивания</Text>

      {packs.map(pack => {
        const isInstalled = downloadedIds.includes(pack.id);
        const isDownloading = downloadingPackId === pack.id;
        const isSelected = selectedId === pack.id;
        const sizeLabel = formatBytes(packSizeBytes(pack));

        return (
          <View
            key={pack.id}
            testID={`jarvis-video-pack-${pack.id}`}
            style={[styles.packCard, isSelected && styles.packCardSelected]}
          >
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>{pack.name}</Text>
              <Text style={styles.meta}>{sizeLabel}</Text>
            </View>

            {!!pack.description && (
              <Text style={styles.body}>{pack.description}</Text>
            )}

            {isDownloading && (
              <View>
                <Text style={styles.meta}>
                  {`Загрузка: ${Math.round(downloadProgress * 100)}%`}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(downloadProgress * 100)}%` },
                    ]}
                  />
                </View>
              </View>
            )}

            <View style={styles.actionsRow}>
              {isDownloading ? (
                <TouchableOpacity
                  testID={`jarvis-video-pack-cancel-${pack.id}`}
                  style={styles.dangerButton}
                  onPress={() => jarvisVideoService.cancelVideoDownload()}
                >
                  <Icon name="x" size={14} color={colors.error} />
                  <Text style={styles.dangerButtonText}>Отменить</Text>
                </TouchableOpacity>
              ) : isInstalled ? (
                <>
                  <TouchableOpacity
                    testID={`jarvis-video-pack-select-${pack.id}`}
                    style={isSelected ? styles.secondaryButton : styles.primaryButton}
                    onPress={() => {
                      setSelectedVideoPackId(pack.id);
                      onSelect?.();
                    }}
                  >
                    <Icon
                      name={isSelected ? 'check' : 'play'}
                      size={14}
                      color={isSelected ? colors.primary : colors.onPrimary}
                    />
                    <Text
                      style={
                        isSelected ? styles.secondaryButtonText : styles.primaryButtonText
                      }
                    >
                      {isSelected ? 'Выбрана' : 'Выбрать'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`jarvis-video-pack-delete-${pack.id}`}
                    style={styles.dangerButton}
                    onPress={() => jarvisVideoService.deleteVideoPack(pack.id).catch(() => {})}
                  >
                    <Icon name="trash-2" size={14} color={colors.error} />
                    <Text style={styles.dangerButtonText}>Удалить</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  testID={`jarvis-video-pack-download-${pack.id}`}
                  style={styles.primaryButton}
                  onPress={() => {
                    jarvisVideoService.downloadVideoPack(pack).catch(() => {});
                  }}
                >
                  <Icon name="download" size={14} color={colors.onPrimary} />
                  <Text style={styles.primaryButtonText}>Скачать модель</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};
