import React from 'react';
import { Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { TouchableOpacity } from '../Touchable';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { useJarvisProStore } from '../../stores';
import type { JarvisVideoBackend } from '../../stores/jarvisProStore';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { cardSurface } from '../../theme/surface';

export interface JarvisVideoSettingsSectionProps {
  alwaysOpen?: boolean;
}

const BACKEND_OPTIONS: ReadonlyArray<{ id: JarvisVideoBackend; label: string }> = [
  { id: 'auto', label: 'Авто' },
  { id: 'gpu', label: 'GPU / Adreno' },
  { id: 'cpu', label: 'CPU' },
];

const createStyles = (colors: ThemeColors) => ({
  card: {
    ...cardSurface(colors),
    padding: SPACING.md,
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: colors.text,
  },
  subtitle: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
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
  statusText: {
    ...TYPOGRAPHY.meta,
    color: colors.textMuted,
  },
});

export const JarvisVideoSettingsSection: React.FC<JarvisVideoSettingsSectionProps> = ({
  alwaysOpen = false,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const videoBackend = useJarvisProStore(s => s.videoBackend);
  const setVideoBackend = useJarvisProStore(s => s.setVideoBackend);
  const downloadedIds = useJarvisProStore(s => s.downloadedVideoPackIds);
  const selectedId = useJarvisProStore(s => s.selectedVideoPackId);

  const activePack = selectedId ?? downloadedIds[0] ?? null;

  return (
    <View style={styles.card} testID="jarvis-video-settings-section">
      <View style={styles.titleRow}>
        <Icon name="video" size={16} color={colors.primary} />
        <Text style={styles.title}>Видео (Wan 2.1 · Локально)</Text>
      </View>

      <Text style={styles.subtitle}>
        {alwaysOpen
          ? 'Локальная генерация видео на устройстве через встроенный движок Wan и Hexagon/CPU.'
          : 'Настройки аппаратного ускорителя для локальной генерации видео.'}
      </Text>

      <View style={styles.row}>
        {BACKEND_OPTIONS.map(option => {
          const active = videoBackend === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              testID={`jarvis-video-backend-${option.id}`}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setVideoBackend(option.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.statusText}>
        {activePack
          ? `Выбран пакет: ${activePack}`
          : 'Видеопакет не загружен — скачайте во вкладке «Модели → Видео».'}
      </Text>
    </View>
  );
};
