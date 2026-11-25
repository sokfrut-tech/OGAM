import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { AppSwitch } from '../AppSwitch';
import { TouchableOpacity } from '../Touchable';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { jarvisTtsService } from '../../services/jarvisPro/jarvisTtsService';
import { useJarvisProStore } from '../../stores';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { cardSurface } from '../../theme/surface';

const RATE_OPTIONS = [0.8, 1.0, 1.2, 1.5] as const;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      ...cardSurface(colors),
      padding: SPACING.md,
      gap: SPACING.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      flex: 1,
    },
    title: {
      ...TYPOGRAPHY.h3,
      color: colors.text,
    },
    subtitle: {
      ...TYPOGRAPHY.bodySmall,
      color: colors.textSecondary,
    },
    rateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    rateLabel: {
      ...TYPOGRAPHY.bodySmall,
      color: colors.textSecondary,
      marginRight: SPACING.xs,
    },
    chip: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.selectedFill,
    },
    chipText: {
      ...TYPOGRAPHY.bodySmall,
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.primary,
    },
    testButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.selectedFill,
    },
    testButtonText: {
      ...TYPOGRAPHY.bodySmall,
      color: colors.primary,
    },
    summaryText: {
      ...TYPOGRAPHY.bodySmall,
      color: colors.textSecondary,
    },
  });

export const JarvisTtsSettingsSummary: React.FC = () => {
  const styles = useThemedStyles(createStyles);
  const autoSpeak = useJarvisProStore(s => s.ttsAutoSpeak);
  const rate = useJarvisProStore(s => s.ttsRate);
  const label = `${autoSpeak ? 'Вкл' : 'Выкл'} · ${rate.toFixed(1)}x`;
  return <Text style={styles.summaryText}>{label}</Text>;
};

export const JarvisTtsSettingsSection: React.FC = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const autoSpeak = useJarvisProStore(s => s.ttsAutoSpeak);
  const rate = useJarvisProStore(s => s.ttsRate);
  const speakingId = useJarvisProStore(s => s.ttsSpeakingMessageId);
  const setAutoSpeak = useJarvisProStore(s => s.setTtsAutoSpeak);
  const setRate = useJarvisProStore(s => s.setTtsRate);

  const isTesting = speakingId === '__settings_test__';

  const handleTestVoice = () => {
    if (isTesting) {
      jarvisTtsService.stop().catch(() => {});
      return;
    }
    jarvisTtsService
      .speak(
        'Привет! Голосовой движок Jarvis Ai настроен для русской офлайн-озвучки.',
        '__settings_test__',
      )
      .catch(() => {});
  };

  return (
    <View style={styles.card} testID="jarvis-tts-settings-section">
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Icon name="volume-2" size={16} color={colors.primary} />
          <Text style={styles.title}>Озвучка ответов (TTS, RU)</Text>
        </View>
        <AppSwitch
          testID="jarvis-tts-autospeak-switch"
          value={autoSpeak}
          onValueChange={setAutoSpeak}
        />
      </View>

      <Text style={styles.subtitle}>
        Автоматически озвучивать готовые ответы ассистента через системный Android TTS.
      </Text>

      <View style={styles.rateRow}>
        <Text style={styles.rateLabel}>Скорость:</Text>
        {RATE_OPTIONS.map(option => {
          const active = Math.abs(rate - option) < 0.05;
          return (
            <TouchableOpacity
              key={option}
              testID={`jarvis-tts-rate-${option}`}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setRate(option)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {`${option.toFixed(1)}x`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        testID="jarvis-tts-test-button"
        style={styles.testButton}
        onPress={handleTestVoice}
      >
        <Icon
          name={isTesting ? 'square' : 'play'}
          size={14}
          color={colors.primary}
        />
        <Text style={styles.testButtonText}>
          {isTesting ? 'Остановить тест' : 'Проверить русскую озвучку'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
