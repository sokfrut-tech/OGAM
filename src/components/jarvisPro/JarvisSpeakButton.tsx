import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { TouchableOpacity } from '../Touchable';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { jarvisTtsService } from '../../services/jarvisPro/jarvisTtsService';
import { useJarvisProStore } from '../../stores';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';

export interface JarvisSpeakButtonProps {
  text?: string;
  messageId?: string;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    buttonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.selectedFill,
    },
    label: {
      ...TYPOGRAPHY.meta,
      color: colors.textSecondary,
    },
    labelActive: {
      color: colors.primary,
    },
  });

export const JarvisSpeakButton: React.FC<JarvisSpeakButtonProps> = ({
  text = '',
  messageId,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const speakingMessageId = useJarvisProStore(s => s.ttsSpeakingMessageId);

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const effectiveId = messageId ?? '__manual__';
  const isSpeaking = speakingMessageId === effectiveId;

  const handlePress = () => {
    if (isSpeaking) {
      jarvisTtsService.stop().catch(() => {});
      return;
    }
    jarvisTtsService.speak(trimmed, effectiveId).catch(() => {});
  };

  return (
    <TouchableOpacity
      testID={isSpeaking ? 'jarvis-speak-stop-button' : 'jarvis-speak-button'}
      accessibilityRole="button"
      accessibilityLabel={isSpeaking ? 'Остановить озвучку' : 'Озвучить ответ'}
      style={[styles.button, isSpeaking && styles.buttonActive]}
      onPress={handlePress}
    >
      <Icon
        name={isSpeaking ? 'volume-x' : 'volume-2'}
        size={12}
        color={isSpeaking ? colors.primary : colors.textSecondary}
      />
      <Text style={[styles.label, isSpeaking && styles.labelActive]}>
        {isSpeaking ? 'Стоп' : 'Озвучить'}
      </Text>
    </TouchableOpacity>
  );
};
