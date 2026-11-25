import React, { useMemo, useState } from 'react';
import {
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';
import { MessageAttachments } from '../../components/ChatMessage/components/MessageAttachments';
import { TouchableOpacity } from '../../components/Touchable';
import { SPACING, TYPOGRAPHY } from '../../constants';
import type { RootStackParamList } from '../../navigation/types';
import { jarvisVideoService } from '../../services/jarvisPro/jarvisVideoService';
import { useChatStore, useJarvisProStore } from '../../stores';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { cardSurface } from '../../theme/surface';
import type { Message } from '../../types';

const createStyles = (colors: ThemeColors) => ({
  bannerCard: {
    ...cardSurface(colors),
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  rowBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: colors.text,
  },
  meta: {
    ...TYPOGRAPHY.meta,
    color: colors.textSecondary,
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
  stopButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
  },
  stopButtonText: {
    ...TYPOGRAPHY.meta,
    color: colors.error,
  },
  videoCard: {
    ...cardSurface(colors),
    padding: SPACING.sm,
    marginVertical: SPACING.xs,
    gap: SPACING.sm,
    width: '100%' as const,
  },
  attachmentsContainer: {
    width: '100%' as const,
  },
  promptText: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.sm,
  },
  secondaryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
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
  gallerySection: {
    ...cardSurface(colors),
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: colors.text,
    backgroundColor: colors.surface,
    minHeight: 54,
    textAlignVertical: 'top' as const,
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.error,
  },
});

function translateStageLabel(stage: string | null): string {
  switch (stage) {
    case 'preparing':
      return 'Подготовка видеодвижка';
    case 'conditioning':
      return 'Кодирование промпта';
    case 'generating':
      return 'Генерация кадров';
    case 'decoding':
      return 'Декодирование кадров';
    case 'encoding':
      return 'Сборка MP4';
    default:
      return 'Создание видео';
  }
}

function openVideoModelsTab(navigation: NativeStackNavigationProp<RootStackParamList>): void {
  navigation.navigate('Main', {
    screen: 'ModelsTab',
    params: { initialTab: 'video' },
  });
}

function deriveGalleryVideoLabel(videoGenerating: boolean, installedCount: number): string {
  if (videoGenerating) return 'Генерация…';
  return installedCount > 0 ? 'Создать видео' : 'Выбрать видеомодель';
}

export const JarvisVideoStatusBanner: React.FC<{ conversationId?: string | null }> = () => {
  const styles = useThemedStyles(createStyles);
  const videoGenerating = useJarvisProStore(s => s.videoGenerating);
  const videoStage = useJarvisProStore(s => s.videoStage);
  const videoStep = useJarvisProStore(s => s.videoStep);
  const videoTotalSteps = useJarvisProStore(s => s.videoTotalSteps);

  const progressRatio = videoTotalSteps > 0 ? Math.min(1, videoStep / videoTotalSteps) : 0;
  const progressFillStyle = useMemo<ViewStyle>(
    () => ({ width: `${Math.round(progressRatio * 100)}%` }),
    [progressRatio],
  );

  if (!videoGenerating) return null;

  return (
    <View style={styles.bannerCard} testID="jarvis-video-status-banner">
      <View style={styles.rowBetween}>
        <Text style={styles.title}>{translateStageLabel(videoStage)}</Text>
        <TouchableOpacity
          testID="jarvis-video-status-cancel"
          style={styles.stopButton}
          onPress={() => {
            jarvisVideoService.cancel().catch(() => {});
          }}
        >
          <Text style={styles.stopButtonText}>Остановить</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.meta}>
        {videoTotalSteps > 0 ? `Шаг ${videoStep} из ${videoTotalSteps}` : 'Обработка на устройстве…'}
      </Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, progressFillStyle]} />
      </View>
    </View>
  );
};

export const JarvisAnimateImageAction: React.FC<{
  imagePath: string;
  conversationId?: string | null;
  onStarted?: () => void;
  buttonStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  iconColor?: string;
}> = ({ imagePath, conversationId, onStarted, buttonStyle, textStyle, iconColor }) => {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleAnimate = () => {
    const installed = useJarvisProStore.getState().downloadedVideoPackIds;
    onStarted?.();
    if (installed.length === 0) {
      openVideoModelsTab(navigation);
      return;
    }
    jarvisVideoService
      .generateVideo({
        prompt: 'плавное кинематографическое движение камеры, живая сцена',
        conversationId: conversationId ?? undefined,
        initImagePath: imagePath,
      })
      .catch(() => {});
  };

  return (
    <TouchableOpacity
      testID="jarvis-animate-image-action"
      style={buttonStyle}
      onPress={handleAnimate}
      accessibilityRole="button"
      accessibilityLabel="Оживить фото в видео"
    >
      <Icon name="film" size={22} color={iconColor ?? colors.text} />
      <Text style={textStyle}>Оживить фото</Text>
    </TouchableOpacity>
  );
};

export const JarvisVideoMessageCard: React.FC<{ message: Message }> = ({ message }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const activeConversationId = useChatStore(s => s.activeConversationId);

  const videoAtt = message.attachments?.find(a => a.type === 'video');
  const videoAttachments = useMemo(() => (videoAtt ? [videoAtt] : []), [videoAtt]);
  const attachmentStyles = useMemo(
    () => ({ attachmentsContainer: styles.attachmentsContainer }),
    [styles.attachmentsContainer],
  );

  if (!videoAtt) return null;

  const cleanPrompt = message.content.replace(/^Видео сгенерировано:\s*/i, '').trim();

  return (
    <View style={styles.videoCard} testID="jarvis-video-message-card">
      <MessageAttachments
        attachments={videoAttachments}
        isUser={false}
        styles={attachmentStyles}
        colors={colors}
      />
      {!!cleanPrompt && <Text style={styles.promptText}>{cleanPrompt}</Text>}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          testID="jarvis-video-message-gallery"
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Gallery')}
        >
          <Icon name="film" size={14} color={colors.text} />
          <Text style={styles.secondaryButtonText}>Галерея</Text>
        </TouchableOpacity>
        {!!cleanPrompt && (
          <TouchableOpacity
            testID="jarvis-video-message-retry"
            style={styles.secondaryButton}
            onPress={() => {
              jarvisVideoService
                .generateVideo({
                  prompt: cleanPrompt,
                  conversationId: activeConversationId ?? undefined,
                })
                .catch(() => {});
            }}
          >
            <Icon name="refresh-cw" size={14} color={colors.text} />
            <Text style={styles.secondaryButtonText}>Ещё вариант</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const JarvisGalleryVideoSection: React.FC = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [prompt, setPrompt] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const videoGenerating = useJarvisProStore(s => s.videoGenerating);
  const downloadedIds = useJarvisProStore(s => s.downloadedVideoPackIds);

  const handleCreate = () => {
    const clean = prompt.trim();
    if (!clean) {
      setLocalError('Введите описание видео.');
      return;
    }
    if (downloadedIds.length === 0) {
      openVideoModelsTab(navigation);
      return;
    }
    setLocalError(null);
    jarvisVideoService.generateVideo({ prompt: clean }).catch(err => {
      setLocalError(err instanceof Error ? err.message : String(err));
    });
  };

  return (
    <View style={styles.gallerySection} testID="jarvis-gallery-video-section">
      <Text style={styles.title}>Создать видео на устройстве</Text>
      <TextInput
        testID="jarvis-gallery-video-input"
        style={styles.input}
        value={prompt}
        onChangeText={text => {
          setPrompt(text);
          if (localError) setLocalError(null);
        }}
        placeholder="Опишите видео на русском или английском…"
        placeholderTextColor={colors.textMuted}
        multiline
      />
      {localError ? <Text style={styles.errorText}>{localError}</Text> : null}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          testID="jarvis-gallery-video-create"
          style={styles.primaryButton}
          disabled={videoGenerating}
          onPress={handleCreate}
        >
          <Icon name="video" size={14} color={colors.onPrimary} />
          <Text style={styles.primaryButtonText}>
            {deriveGalleryVideoLabel(videoGenerating, downloadedIds.length)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="jarvis-gallery-video-models"
          style={styles.secondaryButton}
          onPress={() => openVideoModelsTab(navigation)}
        >
          <Icon name="download" size={14} color={colors.text} />
          <Text style={styles.secondaryButtonText}>Модели</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
