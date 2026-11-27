import React from 'react';
import { View, Text } from 'react-native';
import { TouchableOpacity } from './Touchable';
import Icon from 'react-native-vector-icons/Feather';
import { AppSheet } from './AppSheet';
import { useThemedStyles } from '../theme';
import type { ThemeColors, ThemeShadows } from '../theme';
import { SPACING, TYPOGRAPHY, PRO_AHA_FEATURES } from '../constants';
import { getPricingCopy } from '../utils/proPricing';
import { isJarvisStandaloneRuntime } from '../i18n';

const JARVIS_PRO_FEATURES_RU = [
  'Русская офлайн-озвучка ответов (TTS)',
  'Локальная генерация видео (Wan 2.1)',
  'Инструменты ИИ и пользовательские MCP-серверы',
  'Открытые и русскоязычные модели GGUF без цензуры',
];

interface ProAhaSheetProps {
  visible: boolean;
  onClose: () => void;
  onRegister: () => void;
}

export const ProAhaSheet: React.FC<ProAhaSheetProps> = ({ visible, onClose, onRegister }) => {
  const styles = useThemedStyles(createStyles);
  const pricing = getPricingCopy();

  const handleCta = () => {
    onClose();
    onRegister();
  };

  const featuresList = isJarvisStandaloneRuntime ? JARVIS_PRO_FEATURES_RU : PRO_AHA_FEATURES;
  const sheetTitle = isJarvisStandaloneRuntime ? 'Jarvis Ai Pro' : 'Off Grid AI Pro';
  const headline = isJarvisStandaloneRuntime
    ? 'Все инструменты Pro уже активны локально.'
    : 'It already knows what you did today.';
  const subheadline = isJarvisStandaloneRuntime
    ? 'Никаких подписок, ограничений и внешних сайтов.'
    : pricing.sheetSubheadline;
  const footerText = isJarvisStandaloneRuntime
    ? 'Работает автономно на вашем устройстве.'
    : pricing.sheetFooter;
  const ctaText = isJarvisStandaloneRuntime ? 'Открыть Jarvis Ai Pro' : pricing.cta;

  return (
    <AppSheet sheet="pro-aha" visible={visible} onClose={onClose} enableDynamicSizing title={sheetTitle}>
      <View style={styles.content}>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.subheadline}>{subheadline}</Text>

        <View style={styles.featureList}>
          {featuresList.map(feature => (
            <View key={feature} style={styles.featureRow}>
              <Icon name="check" size={14} color={styles.checkIcon.color} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.guarantee}>{footerText}</Text>

        <TouchableOpacity style={styles.ctaButton} onPress={handleCta}>
          <Text style={styles.ctaText}>{ctaText}</Text>
        </TouchableOpacity>
      </View>
    </AppSheet>
  );
};

const createStyles = (colors: ThemeColors, _shadows: ThemeShadows) => ({
  content: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
    alignItems: 'center' as const,
  },
  headline: {
    ...TYPOGRAPHY.h2,
    color: colors.text,
    textAlign: 'center' as const,
    marginBottom: SPACING.sm,
  },
  subheadline: {
    ...TYPOGRAPHY.body,
    color: colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: SPACING.md,
  },
  priceRow: {
    marginBottom: SPACING.lg,
  },
  price: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.primary,
    textAlign: 'center' as const,
  },
  featureList: {
    width: '100%' as const,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  featureRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.sm,
  },
  checkIcon: {
    color: colors.primary,
  },
  featureText: {
    ...TYPOGRAPHY.body,
    color: colors.text,
  },
  guarantee: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.textMuted,
    textAlign: 'center' as const,
    marginBottom: SPACING.lg,
  },
  ctaButton: {
    width: '100%' as const,
    paddingVertical: SPACING.md,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: SPACING.sm,
  },
  ctaText: {
    ...TYPOGRAPHY.body,
    color: colors.background,
  },
});
