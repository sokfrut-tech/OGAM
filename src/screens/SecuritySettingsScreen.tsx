import React, { useState } from 'react';
import { AppSwitch } from '../components/AppSwitch';
import {
  View,
  Text,
  ScrollView,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { Button } from '../components/Button';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../components';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionLabel } from '../components/SectionLabel';
import { CustomAlert, showAlert, hideAlert, AlertState, initialAlertState } from '../components/CustomAlert';
import { useTheme, useThemedStyles } from '../theme';
import type { ThemeColors, ThemeShadows } from '../theme';
import { TYPOGRAPHY, SPACING } from '../constants';
import { useAuthStore } from '../stores';
import { authService } from '../services';
import { PassphraseSetupScreen } from './PassphraseSetupScreen';
import { AliveScreen } from '../components/AliveScreen';
import { isJarvisStandaloneRuntime, t } from '../i18n';

export const SecuritySettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [showPassphraseSetup, setShowPassphraseSetup] = useState(false);
  const [isChangingPassphrase, setIsChangingPassphrase] = useState(false);
  const [alertState, setAlertState] = useState<AlertState>(initialAlertState);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const {
    isEnabled: authEnabled,
    setEnabled: setAuthEnabled,
  } = useAuthStore();

  const handleTogglePassphrase = async () => {
    if (authEnabled) {
      setAlertState(showAlert(
        isJarvisStandaloneRuntime ? 'Отключить пароль' : 'Disable Passphrase Lock',
        isJarvisStandaloneRuntime
          ? 'Вы уверены, что хотите отключить защиту паролем?'
          : 'Are you sure you want to disable passphrase protection?',
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: isJarvisStandaloneRuntime ? 'Отключить' : 'Disable',
            style: 'destructive',
            onPress: () => {
              setAlertState(hideAlert());
              authService.removePassphrase().then(() => {
                setAuthEnabled(false);
              }).catch(() => {});
            },
          },
        ]
      ));
    } else {
      setIsChangingPassphrase(false);
      setShowPassphraseSetup(true);
    }
  };

  const handleChangePassphrase = () => {
    setIsChangingPassphrase(true);
    setShowPassphraseSetup(true);
  };

  return (
    <AliveScreen style={styles.container}>
      <ScreenHeader title={t('settings.security')} onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <SectionLabel title={t('settings.appLock')} />
        <Card style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>
                {isJarvisStandaloneRuntime ? 'Защита паролем' : 'Passphrase lock'}
              </Text>
              <Text style={styles.settingHint}>
                {isJarvisStandaloneRuntime
                  ? 'Запрашивать пароль при открытии приложения.'
                  : 'Ask for your passphrase when the app opens.'}
              </Text>
            </View>
            <AppSwitch
              value={authEnabled}
              onValueChange={handleTogglePassphrase}
            />
          </View>

          {authEnabled && (
            <Button
              title={t('settings.changePassphrase')}
              variant="secondary"
              size="small"
              onPress={handleChangePassphrase}
              icon={<Icon name="edit-2" size={14} color={colors.textSecondary} />}
              style={{ alignSelf: 'flex-start' as const, marginTop: SPACING.lg }}
            />
          )}
        </Card>

        {/* A footnote under the one card, not a second box (hand test 60). */}
        <Text style={styles.footnote}>
          The app locks when you leave it. Your passphrase stays on this phone.
        </Text>
      </ScrollView>

      <Modal
        visible={showPassphraseSetup}
        animationType="slide"
        onRequestClose={() => setShowPassphraseSetup(false)}
      >
        <PassphraseSetupScreen
          isChanging={isChangingPassphrase}
          onComplete={() => setShowPassphraseSetup(false)}
          onCancel={() => setShowPassphraseSetup(false)}
        />
      </Modal>
      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        onClose={() => setAlertState(hideAlert())}
      />
    </AliveScreen>
  );
};

const createStyles = (colors: ThemeColors, _shadows: ThemeShadows) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  // brand Mobile profile: 24px screen padding; the cards are the shared Card surface.
  content: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.label,
    textTransform: 'uppercase' as const,
    color: colors.textMuted,
    marginBottom: SPACING.md,
    letterSpacing: 0.3,
  },
  settingRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    ...TYPOGRAPHY.body,
    color: colors.text,
  },
  settingHint: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  footnote: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.textMuted,
    marginTop: SPACING.sm,
  },
});
