import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { CustomAlert, hideAlert, type AlertState } from '../../components/CustomAlert';
import { QuickSettingsPopover } from '../../components/ChatInput/Popovers';
import { JarvisSpeakButton } from '../../components/jarvisPro/JarvisSpeakButton';
import { TouchableOpacity } from '../../components/Touchable';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { jarvisTtsService } from '../../services/jarvisPro/jarvisTtsService';
import { useUiModeStore } from '../../stores';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { cardSurface } from '../../theme/surface';
import type { ImageModeState, Message } from '../../types';

const createStyles = (colors: ThemeColors) => ({
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerButtonActive: {
    backgroundColor: colors.selectedFill,
  },
  heroContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  heroBadgeCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.selectedFill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  heroTitle: {
    ...TYPOGRAPHY.h2,
    color: colors.text,
    textAlign: 'center' as const,
  },
  heroSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center' as const,
  },
  heroPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroPillText: {
    ...TYPOGRAPHY.meta,
    color: colors.primary,
  },
  composerBar: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: SPACING.sm,
  },
  statusText: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center' as const,
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.error,
    textAlign: 'center' as const,
  },
  controlsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  sideButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sideButtonText: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.text,
  },
  sideButtonCancelText: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.error,
  },
  rowLabelColor: {
    color: colors.text,
  },
  micButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.primary,
  },
  micButtonRecording: {
    backgroundColor: colors.error,
  },
  micButtonDisabled: {
    opacity: 0.5,
  },
  messageCard: {
    ...cardSurface(colors),
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  messageCardUser: {
    borderColor: colors.primary,
  },
  messageRole: {
    ...TYPOGRAPHY.meta,
    color: colors.textMuted,
  },
  messageBody: {
    ...TYPOGRAPHY.body,
    color: colors.text,
  },
  messageFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  footerAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  footerActionText: {
    ...TYPOGRAPHY.meta,
    color: colors.textMuted,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.surfaceLight,
  },
  badgePillOn: {
    backgroundColor: colors.selectedFill,
  },
  badgeText: {
    ...TYPOGRAPHY.meta,
    color: colors.textMuted,
  },
  badgeTextOn: {
    color: colors.primary,
  },
});

function toggleAudioInterfaceMode(
  isAudio: boolean,
  setInterfaceMode: (mode: 'chat' | 'audio') => void,
): void {
  if (isAudio) {
    jarvisTtsService.stop().catch(() => {});
    setInterfaceMode('chat');
    return;
  }
  setInterfaceMode('audio');
}

export const JarvisChatModeToggle: React.FC = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const interfaceMode = useUiModeStore(s => s.interfaceMode);
  const setInterfaceMode = useUiModeStore(s => s.setInterfaceMode);
  const isAudio = interfaceMode === 'audio';

  return (
    <TouchableOpacity
      testID="jarvis-voice-mode-toggle"
      style={[styles.headerButton, isAudio && styles.headerButtonActive]}
      onPress={() => toggleAudioInterfaceMode(isAudio, setInterfaceMode)}
      accessibilityRole="button"
      accessibilityLabel={isAudio ? 'Переключиться в текстовый чат' : 'Переключиться в голосовой режим'}
    >
      <Icon
        name={isAudio ? 'message-square' : 'headphones'}
        size={16}
        color={isAudio ? colors.primary : colors.textSecondary}
      />
    </TouchableOpacity>
  );
};

export const JarvisQuickSettingsAudioRow: React.FC<{
  styles: { row?: StyleProp<ViewStyle>; rowLabel?: StyleProp<TextStyle> };
  onClose: () => void;
}> = ({ styles: popoverStyles, onClose }) => {
  const { colors } = useTheme();
  const localStyles = useThemedStyles(createStyles);
  const interfaceMode = useUiModeStore(s => s.interfaceMode);
  const setInterfaceMode = useUiModeStore(s => s.setInterfaceMode);
  const isAudio = interfaceMode === 'audio';

  return (
    <TouchableOpacity
      testID="jarvis-quick-voice-mode"
      style={popoverStyles.row}
      onPress={() => {
        toggleAudioInterfaceMode(isAudio, setInterfaceMode);
        onClose();
      }}
    >
      <Icon name="headphones" size={16} color={isAudio ? colors.primary : colors.textSecondary} />
      <Text style={[popoverStyles.rowLabel, localStyles.rowLabelColor]}>Голосовой режим</Text>
      <View style={[localStyles.badgePill, isAudio && localStyles.badgePillOn]}>
        <Text style={[localStyles.badgeText, isAudio && localStyles.badgeTextOn]}>
          {isAudio ? 'ВКЛ' : 'ВЫКЛ'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export const JarvisAudioEmptyHero: React.FC = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const voiceSummary = useUiModeStore(s => s.voiceSummary);

  return (
    <View style={styles.heroContainer} testID="jarvis-audio-empty-hero">
      <View style={styles.heroBadgeCircle}>
        <Icon name="mic" size={30} color={colors.primary} />
      </View>
      <Text style={styles.heroTitle}>Голосовой режим Jarvis Ai</Text>
      <Text style={styles.heroSubtitle}>
        Нажмите на микрофон внизу и задайте вопрос или дайте команду по-русски. Ответ прозвучит вслух.
      </Text>
      <View style={styles.heroPill}>
        <Text style={styles.heroPillText}>
          {voiceSummary ?? 'Русский STT + TTS'}
        </Text>
      </View>
    </View>
  );
};

export interface JarvisAudioComposerProps {
  disabled?: boolean;
  isGenerating?: boolean;
  isRecording: boolean;
  voiceAvailable: boolean;
  isModelLoading?: boolean;
  isTranscribing?: boolean;
  partialResult?: string;
  error?: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onStop?: () => void;
  imageMode: ImageModeState;
  imageModelLoaded: boolean;
  supportsThinking: boolean;
  supportsToolCalling: boolean;
  enabledToolCount: number;
  mcpToolCount?: number;
  onImageModeToggle: () => void;
  onVideoModeToggle?: () => void;
  onToolsPress?: () => void;
  onMcpPress?: () => void;
  quickSettings: {
    visible: boolean;
    anchor: { x: number; y: number };
    triggerRef: React.RefObject<React.ElementRef<typeof TouchableOpacity> | null>;
    show: () => void;
    hide: () => void;
  };
  alertState: AlertState;
  setAlertState: React.Dispatch<React.SetStateAction<AlertState>>;
}

function deriveAudioStatusLabel(props: Pick<
  JarvisAudioComposerProps,
  'partialResult' | 'isTranscribing' | 'isModelLoading' | 'isGenerating' | 'isRecording' | 'voiceAvailable'
>): string {
  if (props.partialResult?.trim()) return props.partialResult.trim();
  if (props.isTranscribing) return 'Распознавание речи…';
  if (props.isModelLoading) return 'Подготовка голосовой модели…';
  if (props.isGenerating) return 'Jarvis Ai отвечает…';
  if (props.isRecording) return 'Слушаю, говорите по-русски…';
  if (!props.voiceAvailable) return 'Микрофон недоступен или нет разрешения';
  return 'Нажмите на микрофон и говорите';
}

function deriveMicIconName(isGenerating?: boolean, isRecording?: boolean): 'square' | 'check' | 'mic' {
  if (isGenerating) return 'square';
  return isRecording ? 'check' : 'mic';
}

export const JarvisAudioComposer: React.FC<JarvisAudioComposerProps> = props => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const setInterfaceMode = useUiModeStore(s => s.setInterfaceMode);

  const handleMainPress = () => {
    if (props.isGenerating) {
      jarvisTtsService.stop().catch(() => {});
      props.onStop?.();
      return;
    }
    if (props.isRecording) {
      props.onStopRecording();
      return;
    }
    props.onStartRecording();
  };

  const mainIcon = deriveMicIconName(props.isGenerating, props.isRecording);
  const mainDisabled = !props.isGenerating && !props.isRecording && (!!props.disabled || !props.voiceAvailable);

  return (
    <View style={styles.composerBar} testID="jarvis-audio-composer">
      {props.error ? (
        <Text style={styles.errorText}>{props.error}</Text>
      ) : (
        <Text style={styles.statusText} numberOfLines={2}>
          {deriveAudioStatusLabel(props)}
        </Text>
      )}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          testID="jarvis-audio-back-to-chat"
          style={styles.sideButton}
          onPress={() => {
            if (props.isRecording) props.onCancelRecording();
            jarvisTtsService.stop().catch(() => {});
            setInterfaceMode('chat');
          }}
        >
          <Icon name="message-square" size={16} color={colors.text} />
          <Text style={styles.sideButtonText}>Чат</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="jarvis-audio-mic-button"
          style={[
            styles.micButton,
            props.isRecording && styles.micButtonRecording,
            mainDisabled && styles.micButtonDisabled,
          ]}
          disabled={mainDisabled}
          onPress={handleMainPress}
          accessibilityRole="button"
          accessibilityLabel={props.isRecording ? 'Завершить запись' : 'Говорить'}
        >
          <Icon name={mainIcon} size={24} color={colors.onPrimary} />
        </TouchableOpacity>

        {props.isRecording ? (
          <TouchableOpacity
            testID="jarvis-audio-cancel"
            style={styles.sideButton}
            onPress={props.onCancelRecording}
          >
            <Icon name="x" size={16} color={colors.error} />
            <Text style={styles.sideButtonCancelText}>Отмена</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            ref={props.quickSettings.triggerRef}
            testID="jarvis-audio-settings"
            style={styles.sideButton}
            onPress={props.quickSettings.show}
          >
            <Icon name="sliders" size={16} color={colors.text} />
            <Text style={styles.sideButtonText}>Опции</Text>
          </TouchableOpacity>
        )}
      </View>

      <QuickSettingsPopover
        visible={props.quickSettings.visible}
        onClose={props.quickSettings.hide}
        anchorY={props.quickSettings.anchor.y}
        anchorX={props.quickSettings.anchor.x}
        imageMode={props.imageMode}
        onImageModeToggle={props.onImageModeToggle}
        onVideoModeToggle={props.onVideoModeToggle}
        imageModelLoaded={props.imageModelLoaded}
        supportsThinking={props.supportsThinking}
        supportsToolCalling={props.supportsToolCalling}
        enabledToolCount={props.enabledToolCount}
        onToolsPress={props.onToolsPress}
        mcpToolCount={props.mcpToolCount}
        onMcpPress={props.onMcpPress}
      />
      <CustomAlert
        visible={props.alertState.visible}
        title={props.alertState.title}
        message={props.alertState.message}
        buttons={props.alertState.buttons}
        onClose={() => props.setAlertState(hideAlert())}
      />
    </View>
  );
};

export const JarvisAudioMessage: React.FC<{
  msg: Message;
  isStreamingThis?: boolean;
  onCopy?: (text: string) => void;
  onRetry?: () => void;
}> = ({ msg, isStreamingThis, onCopy, onRetry }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isUser = msg.role === 'user';

  return (
    <View
      testID="jarvis-audio-message"
      style={[styles.messageCard, isUser && styles.messageCardUser]}
    >
      <Text style={styles.messageRole}>{isUser ? 'Вы' : 'Jarvis Ai'}</Text>
      <Text style={styles.messageBody}>{msg.content || (isStreamingThis ? '…' : '')}</Text>
      {!isStreamingThis && !isUser && !!msg.content.trim() && (
        <View style={styles.messageFooter}>
          <JarvisSpeakButton text={msg.content} messageId={msg.id} />
          {onCopy && (
            <TouchableOpacity style={styles.footerAction} onPress={() => onCopy(msg.content)}>
              <Icon name="copy" size={12} color={colors.textMuted} />
              <Text style={styles.footerActionText}>Копировать</Text>
            </TouchableOpacity>
          )}
          {onRetry && (
            <TouchableOpacity style={styles.footerAction} onPress={onRetry}>
              <Icon name="refresh-cw" size={12} color={colors.textMuted} />
              <Text style={styles.footerActionText}>Повторить</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};
