import React from 'react';
import { Text, View } from 'react-native';
import { TouchableOpacity } from '../components/Touchable';
import Icon from 'react-native-vector-icons/Feather';
import { AnimatedEntry } from '../components/AnimatedEntry';
import type { ThemeColors } from '../theme';
import { t } from '../i18n';

/** The three appearance choices. Declared where they are rendered; the store owns the persisted one. */
type ThemeMode = 'system' | 'light' | 'dark';
import type { createStyles } from './SettingsScreen.styles';

interface SettingsAppearanceRowProps {
  focusTrigger: number;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  themeMode: ThemeMode;
  onSelect: (mode: ThemeMode) => void;
}

/** System, light or dark. Its own component so the Settings render stays inside the 350-line cap. */
export const SettingsAppearanceRow: React.FC<SettingsAppearanceRowProps> = ({
  focusTrigger,
  styles,
  colors,
  themeMode,
  onSelect
}) => (
        <AnimatedEntry index={0} staggerMs={40} trigger={focusTrigger}>
          <View style={styles.navItem}>
            <View style={styles.navItemIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Icon name="aperture" size={16} color={colors.textSecondary} />
            </View>
            <View style={styles.navItemContent}>
              <Text style={styles.navItemTitle}>{t('settings.appearance')}</Text>
            </View>
            <View style={styles.themeSelector}>
              {[
                { mode: 'system' as const, icon: 'monitor', label: t('settings.theme.system') },
                { mode: 'light' as const, icon: 'sun', label: t('settings.theme.light') },
                { mode: 'dark' as const, icon: 'moon', label: t('settings.theme.dark') },
              ].map(({ mode, icon, label }) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.themeSelectorOption,
                    themeMode === mode && styles.themeSelectorOptionActive,
                  ]}
                  onPress={() => onSelect(mode)}
                  testID={`theme-option-${mode}`}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: themeMode === mode }}
                >
                  <Icon
                    name={icon}
                    size={16}
                    color={
                      themeMode === mode ? colors.text : colors.textMuted
                    }
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </AnimatedEntry>
);
