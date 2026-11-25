import { AppSwitch } from '../components/AppSwitch';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Platform,
  AppState,
} from 'react-native';
import { TouchableOpacity } from '../components/Touchable';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  useNavigation,
  CommonActions,
  CompositeNavigationProp,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { createStyles } from './SettingsScreen.styles';
import { SettingsAppearanceRow } from './SettingsAppearanceRow';
import { SettingsCommunitySections } from './SettingsCommunitySections';
import { AnimatedEntry } from '../components/AnimatedEntry';
import { AnimatedListItem } from '../components/AnimatedListItem';
import { MadeWithLove } from '../components/MadeWithLove';
import { DebugLogsScreen } from '../components/DebugLogsScreen';
import { useSettingsSections } from '../components/settings/sectionRegistry';
import { ProUpsellBanner } from '../components/settings/ProUpsellBanner';
import { useFocusTrigger } from '../hooks/useFocusTrigger';
import { useTheme, useThemedStyles } from '../theme';
import RNFS from 'react-native-fs';
import { useAppStore, useRemoteServerStore } from '../stores';
import { hardwareService } from '../services';
import { RootStackParamList, MainTabParamList } from '../navigation/types';
import { useHasRegisteredScreen } from '../navigation/screenRegistry';
import { clearProForTesting } from '../services/proLicenseService';
import { useProStatusLabel } from '../hooks/useProStatusLabel';
import { useOpenSync } from '../hooks/useOpenSync';
import { appBuildLabel, appVersion } from '../utils/appVersion';
import { ScreenHeader } from '../components/ScreenHeader';
import { openSupportEmail } from '../utils/supportEmail';
import { SCROLL_DEPTH_PROPS } from '../constants/scrollDepth';
import { ScreenField } from '../components/LivingField';
import { useGetPro } from '../hooks/useGetPro';
import { getJarvisAssistantRoleStatus, requestJarvisAssistantRole, type JarvisAssistantRoleStatus } from '../services/jarvisAssistantRole';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'SettingsTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/** Developer-only: load the demo fixture and report what it added. Never throws. */
async function loadDemoData(): Promise<void> {
  try {
    const { seedDemoData } = require('../services/demoSeed');
    const { buildVoiceAttachment } = require('../components/ChatInput/voiceNoteSend');
    const result = await seedDemoData({ buildVoiceAttachment });
    const missing = result.warnings.length ? `\n\n${result.warnings.join('\n\n')}` : '';
    Alert.alert(
      result.warnings.length ? 'Demo loaded with missing documents' : 'Demo ready',
      `${result.chats} chats and ${result.documents} documents added. Existing matching demo records were kept.${missing}`,
    );
  } catch (error) {
    Alert.alert('Demo not loaded', error instanceof Error ? error.message : String(error));
  }
}

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const focusTrigger = useFocusTrigger();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  // Reactive: Pro sections registered at runtime (license-key activation re-runs
  // loadProFeatures) show up live without an app restart.
  const settingsSections = useSettingsSections();
  const hasSync = useHasRegisteredScreen('Sync');
  const { isSyncUnlocked, openSync } = useOpenSync();
  const getPro = useGetPro();
  const setOnboardingComplete = useAppStore(s => s.setOnboardingComplete);
  const themeMode = useAppStore(s => s.themeMode);
  const setThemeMode = useAppStore(s => s.setThemeMode);
  const completeChecklistStep = useAppStore(s => s.completeChecklistStep);
  const showSyncStatusBar = useAppStore(s => s.showSyncStatusBar);
  const setShowSyncStatusBar = useAppStore(s => s.setShowSyncStatusBar);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [assistantRoleStatus, setAssistantRoleStatus] = useState<JarvisAssistantRoleStatus | null>(null);
  const [isRequestingAssistantRole, setIsRequestingAssistantRole] = useState(false);
  const deviceInfo = useAppStore(s => s.deviceInfo);
  // Hidden once the user dismisses it, or once Pro is active (the upsell makes no
  // sense to a paid user). hasRegisteredPro only flips true after RC verification
  // (activateProByEmail / revalidatePro), so this also covers "paid and verified".
  const devProDisabled = useAppStore(s => s.devProDisabled);
  const setDevProDisabled = useAppStore(s => s.setDevProDisabled);
  const setHasRegisteredPro = useAppStore(s => s.setHasRegisteredPro);
  const { proStatusLabel } = useProStatusLabel();

  useEffect(() => {
    completeChecklistStep('exploredSettings');
  }, [completeChecklistStep]);

  // Refresh after returning from Android's RoleManager dialog or app Settings.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let mounted = true;
    const refreshAssistantRole = async () => {
      try {
        const status = await getJarvisAssistantRoleStatus();
        if (mounted) setAssistantRoleStatus(status);
      } catch {
        if (mounted) setAssistantRoleStatus(null);
      }
    };
    void refreshAssistantRole();
    const appState = AppState.addEventListener('change', next => {
      if (next === 'active') void refreshAssistantRole();
    });
    const navigationFocus = navigation.addListener('focus', () => {
      void refreshAssistantRole();
    });
    return () => {
      mounted = false;
      appState.remove();
      navigationFocus();
    };
  }, [navigation]);

  const handleSetJarvisAssistant = async () => {
    if (isRequestingAssistantRole) return;
    setIsRequestingAssistantRole(true);
    try {
      const status = await requestJarvisAssistantRole();
      setAssistantRoleStatus(status);
      if (!status.supported) {
        Alert.alert('Джарвис — системный помощник', 'Для интеграции с системным помощником требуется Android 12 или новее. Голосовой ввод внутри Джарвис остаётся доступен на поддерживаемых версиях Android.');
      } else if (!status.roleAvailable) {
        Alert.alert('Системный помощник Джарвис', 'Эта версия Android/ColorOS пока не предоставляет Джарвис роль системного помощника.');
      } else if (status.ready) {
        Alert.alert('Джарвис включён', 'Теперь Джарвис выбран системным помощником.');
      } else if (status.roleHeld) {
        Alert.alert('Джарвис выбран', 'Android предоставил Джарвис роль помощника. Системная служба ещё не сообщила об активации. Вернись в настройки позже, чтобы обновить статус.');
      } else {
        Alert.alert('Джарвис не выбран', 'Android не назначил Джарвис помощником по умолчанию. Попробуй ещё раз или выбери его в настройках приложений по умолчанию.');
      }
    } catch (error) {
      Alert.alert('Не удалось открыть выбор помощника', error instanceof Error ? error.message : String(error));
    } finally {
      setIsRequestingAssistantRole(false);
    }
  };

  const assistantRoleDescription = !assistantRoleStatus
    ? 'Проверить поддержку системного помощника Android'
    : !assistantRoleStatus.supported
      ? 'Требуется Android 12 или новее'
      : !assistantRoleStatus.roleAvailable
        ? 'Недоступно в этой версии Android/ColorOS'
        : assistantRoleStatus.ready
          ? 'Джарвис — системный помощник по умолчанию'
          : assistantRoleStatus.roleHeld
            ? 'Android ещё не активировал службу Джарвис'
            : 'Запускай Джарвис жестом системного помощника';

  const handleSendFeedback = async () => {
    const { downloadedModels, activeModelId } = useAppStore.getState();
    const { activeServerId } = useRemoteServerStore.getState();

    const fsInfo = await RNFS.getFSInfo();

    const ramGB = hardwareService.getTotalMemoryGB().toFixed(1);
    const tier = hardwareService.getDeviceTier();
    const freeGB = (fsInfo.freeSpace / (1024 * 1024 * 1024)).toFixed(1);
    const activeModel = downloadedModels.find(m => m.id === activeModelId);
    const modelLine = activeModel ? activeModel.fileName : 'Нет';
    const remoteServer = activeServerId ? 'Да' : 'Нет';
    const deviceLine = deviceInfo
      ? `Устройство: ${deviceInfo.deviceModel} (${deviceInfo.systemName} ${deviceInfo.systemVersion})`
      : 'Устройство: неизвестно';

    const subject = `[Отзыв] Джарвис AI v${appVersion()}`;
    const body =
      `Здравствуйте!\n\n[Опишите отзыв или проблему]\n\n` +
        `---\n` +
        `App: ${appBuildLabel()}\n` +
        `${deviceLine}\n` +
        `RAM: ${ramGB} GB · Tier: ${tier}\n` +
        `Model: ${modelLine}\n` +
        `Free storage: ${freeGB} GB\n` +
        `Remote server: ${remoteServer}`;
    await openSupportEmail({ subject, body });
  };

  // DEV-only: flip the Pro auto-unlock. Disabling also clears the cached license
  // so the build behaves like a fresh free install. We flip the store flags
  // synchronously (so the UI drops Pro immediately) and do NOT auto-reload —
  // an immediate reload races the async persist write and rehydrates the old
  // Pro-active state. A manual restart applies feature load/unload (slots
  // registered at boot can't be cleanly torn down at runtime).
  const handleToggleDevPro = async () => {
    const disabling = !devProDisabled;
    if (disabling) {
      setDevProDisabled(true);
      await clearProForTesting();
      setHasRegisteredPro(false);
    } else {
      setDevProDisabled(false);
    }
    Alert.alert(
      disabling ? 'Pro disabled (DEV)' : 'Pro enabled (DEV)',
      `Restart the app to fully ${disabling ? 'unload' : 'load'} Pro features.`,
    );
  };

  const handleSeedDemo = async () => {
    if (!__DEV__ || isSeedingDemo) return;
    setIsSeedingDemo(true);
    await loadDemoData();
    setIsSeedingDemo(false);
  };

  const handleResetOnboarding = () => {
    setOnboardingComplete(false);
    // Navigate to root stack and reset to Onboarding
    // getParent() reaches the RootStack from inside the Tab navigator
    navigation.getParent()?.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      }),
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* The living field behind the tab, resting while the tab is hidden. */}
      <ScreenField />
      <ScreenHeader title="Настройки" variant="tab" />
      <ScrollView
        {...SCROLL_DEPTH_PROPS}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        {/* PRO Banner */}
        <ProUpsellBanner
          trigger={focusTrigger}
          onGetPro={() => getPro('settings-banner')}
        />

        {/* Navigation Items. Appearance is the first row of the same list, not a card of its own
            (hand test 43: its own 68 pt card, label out of line with the rows). */}
          <View style={styles.navSection}>
            <SettingsAppearanceRow
              focusTrigger={focusTrigger}
              styles={styles}
              colors={colors}
              themeMode={themeMode}
              onSelect={setThemeMode}
            />
            {Platform.OS === 'android' ? (
              <TouchableOpacity
                style={styles.navItem}
                onPress={handleSetJarvisAssistant}
                disabled={isRequestingAssistantRole || assistantRoleStatus?.supported === false || assistantRoleStatus?.roleAvailable === false || assistantRoleStatus?.roleHeld === true}
                testID="set-jarvis-system-assistant"
                accessibilityRole="button"
                accessibilityLabel={`Jarvis system assistant. ${assistantRoleDescription}`}
                accessibilityState={{ disabled: isRequestingAssistantRole, busy: isRequestingAssistantRole }}
              >
                <View style={styles.navItemIcon}>
                  <Icon name="mic" size={16} color={colors.textSecondary} />
                </View>
                <View style={styles.navItemContent}>
                  <Text style={styles.navItemTitle}>
                    {isRequestingAssistantRole ? 'Открываю настройки Android…' : assistantRoleStatus?.ready ? 'Jarvis system assistant' : assistantRoleStatus?.roleHeld ? 'Jarvis selected' : 'Выбрать Джарвис помощником'}
                  </Text>
                  <Text style={styles.navItemDesc} numberOfLines={1}>{assistantRoleDescription}</Text>
                </View>
                <Icon name={assistantRoleStatus?.ready ? 'check' : 'chevron-right'} size={16} color={assistantRoleStatus?.ready ? colors.primary : colors.textMuted} />
              </TouchableOpacity>
            ) : null}
            {[
              {
                icon: 'sliders',
                title: 'Настройки модели',
                desc: 'Инструкции, ответы и скорость',
                screen: 'ModelSettings' as const,
                testID: 'open-model-settings',
              },
              {
                // Its own page (Back returns here), showing the same picker as Models → Search.
                icon: 'search',
                title: 'Поиск по документам',
                // What it does for you; the model's name is one tap in, on its own screen.
                desc: 'Как находить нужные фрагменты файлов в диалогах',
                screen: 'SearchModel' as const,
                testID: 'open-search-model',
              },
              {
                icon: 'wifi',
                title: 'Удалённые серверы',
                desc: 'Твой компьютер, Ollama или LM Studio',
                screen: 'RemoteServers' as const,
              },
              ...(hasSync
                ? [
                    {
                      icon: 'refresh-cw',
                      title: isSyncUnlocked ? 'Синхронизация' : 'Синхронизация с Pro',
                      desc: isSyncUnlocked
                        ? 'Диалоги и файлы на всех твоих устройствах'
                        : 'Диалоги и файлы на всех устройствах с Pro',
                      screen: 'Sync' as const,
                      testID: 'open-sync-settings',
                    },
                  ]
                : []),
              //  { icon: 'search', title: 'Web Search', desc: 'Configure search API key for reliable results', screen: 'WebSearchSettings' as const },
              {
                icon: 'lock',
                title: 'Безопасность',
                desc: 'Парольная фраза и блокировка приложения',
                screen: 'SecuritySettings' as const,
              },
              {
                icon: 'smartphone',
                title: 'Информация об устройстве',
                desc: 'Оборудование и совместимость',
                screen: 'DeviceInfo' as const,
              },
              {
                icon: 'hard-drive',
                title: 'Хранилище',
                desc: 'Модели и использование памяти',
                screen: 'StorageSettings' as const,
              },
              {
                icon: 'cpu',
                title: 'Обновления движка',
                desc: 'Компонент, который запускает модели',
                screen: 'EngineUpdates' as const,
                testID: 'open-engine-updates',
              },
            ].map((item, index) => (
              <AnimatedListItem
                key={item.screen}
                index={index + 1}
                staggerMs={40}
                trigger={focusTrigger}
                style={styles.navItem}
                onPress={() => {
                  if (item.screen === 'Sync') openSync();
                  // Document search has one home, the Models tab's Documents; a second screen here
                  // copied it (hand test 84).
                  else if (item.screen === 'SearchModel') navigation.navigate('ModelsTab', { initialTab: 'embedding' });
                  else navigation.navigate(item.screen);
                }}
                testID={'testID' in item ? item.testID : undefined}
                // Said in words. A grouped row builds its label from its children, and on iOS an icon
                // child gives its glyph ("\uf193, Security", hand test 40) whatever label it carries.
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.desc}`}
              >
                <View style={styles.navItemIcon}>
                  <Icon
                    name={item.icon}
                    size={16}
                    color={colors.textSecondary}
                  />
                </View>
                <View style={styles.navItemContent}>
                  <Text style={styles.navItemTitle}>{item.title}</Text>
                  {/* One line, so every row in the list keeps one height (design philosophy: rhythm). */}
                  <Text style={styles.navItemDesc} numberOfLines={1}>{item.desc}</Text>
                </View>
                <Icon name="chevron-right" size={16} color={colors.textMuted} />
              </AnimatedListItem>
            ))}
            {/* Pro is the last row of this list, not a card on its own (hand tests 60-62). */}
            <TouchableOpacity
              style={[styles.navItem, styles.navItemLast]}
              onPress={() => getPro('settings')}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Джарвис AI Pro. ${proStatusLabel}`}
            >
              <View style={styles.navItemIcon}>
                <IconMC name="crown" size={16} color={colors.textSecondary} />
              </View>
              <View style={styles.navItemContent}>
                <Text style={styles.navItemTitle}>Джарвис AI Pro</Text>
                <Text style={styles.navItemDesc}>{proStatusLabel}</Text>
              </View>
              <Icon name="chevron-right" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>


        <SettingsCommunitySections
          focusTrigger={focusTrigger}
          styles={styles}
          colors={colors}
          onSendFeedback={handleSendFeedback}
        />


        {/* About */}
        <AnimatedEntry index={9} staggerMs={40} trigger={focusTrigger}>
          <View style={styles.navSection}>
            <TouchableOpacity
              style={[styles.navItem, styles.navItemLast]}
              onPress={() => navigation.navigate('About')}
              accessibilityRole="button"
              accessibilityLabel="О приложении"
            >
              <View style={styles.navItemIcon}>
                <Icon name="info" size={16} color={colors.textSecondary} />
              </View>
              <View style={styles.navItemContent}>
                <Text style={styles.navItemTitle}>О приложении</Text>
                <Text style={styles.navItemDesc}>
                  Версия {appVersion()}
                </Text>
              </View>
              <Icon name="chevron-right" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </AnimatedEntry>

        {/* Pro feature sections registered at runtime by @offgrid/pro */}
        {settingsSections.map((Section, i) => (
          <Section key={Section.displayName ?? String(i)} />
        ))}

        {/* Dev-only tooling — stripped from release builds */}
        {__DEV__ && (
          <AnimatedEntry index={11} staggerMs={40} trigger={focusTrigger}>
            <View style={styles.devButtonGroup}>
              <View style={styles.devButton}>
                <Text style={styles.devButtonText}>Show sync status bar</Text>
                <AppSwitch
                  accessibilityLabel="Show sync status bar"
                  value={showSyncStatusBar}
                  onValueChange={setShowSyncStatusBar}
                />
              </View>
              <TouchableOpacity
                style={styles.devButton}
                onPress={handleSeedDemo}
                disabled={isSeedingDemo}
                accessibilityRole="button"
                accessibilityLabel={
                  isSeedingDemo ? 'Loading demo data' : 'Load demo data'
                }
                accessibilityState={{
                  disabled: isSeedingDemo,
                  busy: isSeedingDemo,
                }}
                testID="seed-demo-data"
              >
                <Icon name="database" size={14} color={colors.textMuted} />
                <Text style={styles.devButtonText}>
                  {isSeedingDemo ? 'Loading demo data...' : 'Load demo data'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.devButton}
                onPress={handleResetOnboarding}
              >
                <Icon name="rotate-ccw" size={14} color={colors.textMuted} />
                <Text style={styles.devButtonText}>Reset onboarding</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.devButton}
                onPress={() => setShowDebugLogs(true)}
              >
                <Icon name="terminal" size={14} color={colors.textMuted} />
                <Text style={styles.devButtonText}>Debug logs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.devButton}
                onPress={handleToggleDevPro}
              >
                <Icon
                  name={devProDisabled ? 'unlock' : 'lock'}
                  size={14}
                  color={colors.textMuted}
                />
                <Text style={styles.devButtonText}>
                  {devProDisabled ? 'Turn on Pro (DEV)' : 'Turn off Pro (DEV)'}
                </Text>
              </TouchableOpacity>
            </View>
          </AnimatedEntry>
        )}

        <MadeWithLove />
        {__DEV__ && (
          <DebugLogsScreen
            visible={showDebugLogs}
            onClose={() => setShowDebugLogs(false)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
