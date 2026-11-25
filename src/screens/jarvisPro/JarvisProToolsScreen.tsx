import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';
import { AliveScreen } from '../../components/AliveScreen';
import { AppSwitch } from '../../components/AppSwitch';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TouchableOpacity } from '../../components/Touchable';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { SCROLL_DEPTH_PROPS } from '../../constants/scrollDepth';
import type { RootStackParamList } from '../../navigation/types';
import {
  addMcpServer,
  refreshMcpServerTools,
} from '../../services/jarvisPro/jarvisMcpService';
import { offeredTools } from '../../services/tools';
import { useAppStore, useJarvisProStore } from '../../stores';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { cardSurface } from '../../theme/surface';

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
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
    toolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: SPACING.sm,
    },
    toolTextCol: {
      flex: 1,
      gap: 2,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    primaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
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
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
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
    iconActionButton: {
      padding: SPACING.xs,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    errorText: {
      ...TYPOGRAPHY.bodySmall,
      color: colors.error,
    },
  });

export const JarvisProToolsScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const enabledTools = useAppStore(st => st.settings.enabledTools) || [];
  const updateSettings = useAppStore(st => st.updateSettings);

  const mcpServers = useJarvisProStore(st => st.mcpServers);
  const toggleMcpServerEnabled = useJarvisProStore(st => st.toggleMcpServerEnabled);
  const toggleMcpToolEnabled = useJarvisProStore(st => st.toggleMcpToolEnabled);
  const removeMcpServer = useJarvisProStore(st => st.removeMcpServer);

  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busyServerId, setBusyServerId] = useState<string | null>(null);

  const builtInTools = offeredTools();

  const toggleTool = (toolId: string, enable: boolean) => {
    const cur = useAppStore.getState().settings.enabledTools || [];
    const next = enable
      ? Array.from(new Set([...cur, toolId]))
      : cur.filter(id => id !== toolId);
    updateSettings({ enabledTools: next });
  };

  const handleEnableAll = () => {
    updateSettings({ enabledTools: builtInTools.map(tool => tool.id) });
  };

  const handleDisableAll = () => {
    updateSettings({ enabledTools: [] });
  };

  const handleAddServer = async () => {
    setFormError(null);
    try {
      await addMcpServer(serverName, serverUrl);
      setServerName('');
      setServerUrl('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRefreshServer = async (serverId: string) => {
    setBusyServerId(serverId);
    try {
      await refreshMcpServerTools(serverId);
    } catch {
      // Errors are written to server.lastError inside jarvisMcpService.
    } finally {
      setBusyServerId(null);
    }
  };

  return (
    <AliveScreen>
      <ScreenHeader
        title="Инструменты и MCP"
        onBack={() => navigation.goBack()}
        testID="jarvis-pro-tools-header"
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        {...SCROLL_DEPTH_PROPS}
        testID="jarvis-pro-tools-screen"
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Встроенные инструменты Pro</Text>
          <Text style={styles.body}>
            Все локальные инструменты работают без ограничений и внешних ключей.
          </Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              testID="jarvis-tools-enable-all"
              style={styles.primaryButton}
              onPress={handleEnableAll}
            >
              <Text style={styles.primaryButtonText}>Включить все</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="jarvis-tools-disable-all"
              style={styles.secondaryButton}
              onPress={handleDisableAll}
            >
              <Text style={styles.secondaryButtonText}>Отключить все</Text>
            </TouchableOpacity>
          </View>

          {builtInTools.map(tool => {
            const active = enabledTools.includes(tool.id);
            return (
              <View key={tool.id} style={styles.toolRow}>
                <View style={styles.toolTextCol}>
                  <Text style={styles.sectionTitle}>{tool.name}</Text>
                  <Text style={styles.meta}>{tool.description}</Text>
                </View>
                <AppSwitch
                  testID={`jarvis-pro-tool-${tool.id}`}
                  value={active}
                  onValueChange={val => toggleTool(tool.id, val)}
                />
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Локальные модули Pro</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              testID="jarvis-pro-open-voice"
              style={styles.secondaryButton}
              onPress={() =>
                navigation.navigate('Main', {
                  screen: 'ModelsTab',
                  params: { initialTab: 'voice' },
                })
              }
            >
              <Icon name="mic" size={14} color={colors.text} />
              <Text style={styles.secondaryButtonText}>Голос (RU TTS)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="jarvis-pro-open-video"
              style={styles.secondaryButton}
              onPress={() =>
                navigation.navigate('Main', {
                  screen: 'ModelsTab',
                  params: { initialTab: 'video' },
                })
              }
            >
              <Icon name="video" size={14} color={colors.text} />
              <Text style={styles.secondaryButtonText}>Видео (Wan 2.1)</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Пользовательские MCP-серверы (HTTP JSON-RPC)</Text>
          <Text style={styles.body}>
            Подключите свой локальный или удалённый MCP-сервер по http:// или https://.
          </Text>

          <TextInput
            testID="jarvis-mcp-name-input"
            style={styles.input}
            placeholder="Название (необязательно)"
            placeholderTextColor={colors.textMuted}
            value={serverName}
            onChangeText={setServerName}
          />
          <TextInput
            testID="jarvis-mcp-url-input"
            style={styles.input}
            placeholder="https://example.com/mcp"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={serverUrl}
            onChangeText={setServerUrl}
          />

          {!!formError && <Text style={styles.errorText}>{formError}</Text>}

          <TouchableOpacity
            testID="jarvis-mcp-add-button"
            style={styles.primaryButton}
            onPress={() => {
              handleAddServer().catch(() => {});
            }}
          >
            <Icon name="plus" size={14} color={colors.onPrimary} />
            <Text style={styles.primaryButtonText}>Добавить MCP-сервер</Text>
          </TouchableOpacity>

          {mcpServers.map(server => (
            <View key={server.id} testID={`jarvis-mcp-server-${server.id}`} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.toolTextCol}>
                  <Text style={styles.sectionTitle}>{server.name}</Text>
                  <Text style={styles.meta}>{server.url}</Text>
                </View>
                <TouchableOpacity
                  testID={`jarvis-mcp-refresh-${server.id}`}
                  style={styles.iconActionButton}
                  disabled={busyServerId === server.id}
                  onPress={() => {
                    handleRefreshServer(server.id).catch(() => {});
                  }}
                >
                  <Icon name="refresh-cw" size={14} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`jarvis-mcp-remove-${server.id}`}
                  style={styles.iconActionButton}
                  onPress={() => removeMcpServer(server.id)}
                >
                  <Icon name="trash-2" size={14} color={colors.error} />
                </TouchableOpacity>
                <AppSwitch
                  testID={`jarvis-mcp-toggle-${server.id}`}
                  value={server.enabled}
                  onValueChange={val => toggleMcpServerEnabled(server.id, val)}
                />
              </View>

              {!!server.lastError && <Text style={styles.errorText}>{server.lastError}</Text>}

              {server.tools.map(tool => (
                <View key={tool.name} style={styles.toolRow}>
                  <View style={styles.toolTextCol}>
                    <Text style={styles.body}>{tool.name}</Text>
                    {!!tool.description && <Text style={styles.meta}>{tool.description}</Text>}
                  </View>
                  <AppSwitch
                    testID={`jarvis-mcp-tool-${server.id}-${tool.name}`}
                    value={tool.enabled}
                    onValueChange={val => toggleMcpToolEnabled(server.id, tool.name, val)}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </AliveScreen>
  );
};
