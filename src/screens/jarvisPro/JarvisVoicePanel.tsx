import React, { useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { NavigationContext } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import { AppSwitch } from '../../components/AppSwitch';
import { TouchableOpacity } from '../../components/Touchable';
import { SPACING, TYPOGRAPHY } from '../../constants';
import { SCROLL_DEPTH_PROPS } from '../../constants/scrollDepth';
import {
  jarvisSttService,
  type JarvisSttEngineInfo,
} from '../../services/jarvisPro/jarvisSttService';
import {
  jarvisTtsService,
  type JarvisTtsVoice,
} from '../../services/jarvisPro/jarvisTtsService';
import {
  isEnglishOnlyWhisperModel,
  transcriptionModelName,
} from '../../services/whisperModels';
import { useJarvisProStore, useWhisperStore } from '../../stores';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import { cardSurface } from '../../theme/surface';

export interface JarvisVoicePanelProps {
  showRemoteModels?: boolean;
}

const RATE_OPTIONS = [0.8, 1.0, 1.2, 1.5] as const;

const createStyles = (colors: ThemeColors) => ({
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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.sm,
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: colors.text,
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
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.selectedFill,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  badgeText: {
    ...TYPOGRAPHY.meta,
    color: colors.primary,
  },
  chipRow: {
    flexDirection: 'row' as const,
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
  primaryButton: {
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
    ...TYPOGRAPHY.body,
    color: colors.onPrimary,
  },
  voiceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});

function describeVoicePanelStt(
  downloadedSttId: string | null,
  sttLanguage: string,
  sttInfo: JarvisSttEngineInfo | null,
  showRemoteModels: boolean,
): string {
  const remoteSuffix = showRemoteModels
    ? ' Также доступны удалённые голосовые серверы в настройках.'
    : '';
  if (isEnglishOnlyWhisperModel(downloadedSttId)) {
    return `Активна английская модель (${downloadedSttId}) — русскую речь не понимает. Язык: ${sttLanguage}.${remoteSuffix}`;
  }
  if (downloadedSttId) {
    return `Активная модель: ${transcriptionModelName(downloadedSttId)} (язык: ${sttLanguage}).${remoteSuffix}`;
  }
  return `Системный Android STT (${sttInfo?.servicePackage ?? 'Google / OEM'}, язык: ${sttLanguage}).${remoteSuffix}`;
}

export const JarvisVoicePanel: React.FC<JarvisVoicePanelProps> = ({
  showRemoteModels = false,
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const navigation = useContext(NavigationContext);
  const autoSpeak = useJarvisProStore(s => s.ttsAutoSpeak);
  const rate = useJarvisProStore(s => s.ttsRate);
  const selectedVoiceId = useJarvisProStore(s => s.ttsVoiceId);
  const speakingId = useJarvisProStore(s => s.ttsSpeakingMessageId);
  const setAutoSpeak = useJarvisProStore(s => s.setTtsAutoSpeak);
  const setRate = useJarvisProStore(s => s.setTtsRate);
  const setVoiceId = useJarvisProStore(s => s.setTtsVoiceId);
  const downloadedSttId = useWhisperStore(s => s.downloadedModelId);
  const sttLanguage = useWhisperStore(s => s.transcriptionLanguage);

  const [ttsReady, setTtsReady] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<JarvisTtsVoice[]>([]);
  const [sttInfo, setSttInfo] = useState<JarvisSttEngineInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await jarvisTtsService.canSpeak();
      const loadedVoices = ok ? await jarvisTtsService.listVoices() : [];
      const engine = await jarvisSttService.getEngineInfo();
      if (cancelled) return;
      setTtsReady(ok);
      setVoices(loadedVoices);
      setSttInfo(engine);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const isTesting = speakingId === '__voice_panel_test__';

  const handleTestSpeech = () => {
    if (isTesting) {
      jarvisTtsService.stop().catch(() => {});
      return;
    }
    jarvisTtsService
      .speak(
        'Привет! Русский голосовой движок Jarvis Ai готов к работе без интернета.',
        '__voice_panel_test__',
      )
      .catch(() => {});
  };

  const ruVoices = voices.filter(v => v.locale.toLowerCase().startsWith('ru'));
  const displayVoices = (ruVoices.length > 0 ? ruVoices : voices).slice(0, 8);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      {...SCROLL_DEPTH_PROPS}
      testID="jarvis-voice-panel"
    >
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.titleRow}>
            <Icon name="volume-2" size={18} color={colors.primary} />
            <Text style={styles.title}>Русская озвучка (TTS)</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {ttsReady === false ? 'Нет движка' : 'Офлайн Android'}
            </Text>
          </View>
        </View>
        <Text style={styles.body}>
          Системный синтез речи Android работает полностью на устройстве и поддерживает
          русские офлайн-голоса Google TTS без подписок и серверов.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>Автоозвучка ответов</Text>
          </View>
          <AppSwitch
            testID="jarvis-voice-autospeak-switch"
            value={autoSpeak}
            onValueChange={setAutoSpeak}
          />
        </View>
        <Text style={styles.body}>
          Озвучивать каждый новый ответ после завершения генерации в чате.
        </Text>

        <View style={styles.chipRow}>
          {RATE_OPTIONS.map(option => {
            const active = Math.abs(rate - option) < 0.05;
            return (
              <TouchableOpacity
                key={option}
                testID={`jarvis-voice-rate-${option}`}
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
          testID="jarvis-voice-test-button"
          style={styles.primaryButton}
          onPress={handleTestSpeech}
        >
          <Icon
            name={isTesting ? 'square' : 'play'}
            size={15}
            color={colors.onPrimary}
          />
          <Text style={styles.primaryButtonText}>
            {isTesting ? 'Остановить озвучку' : 'Проверить русскую речь'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Голоса устройства (RU)</Text>
        {displayVoices.length === 0 ? (
          <Text style={styles.body}>
            Будет использован системный русский голос по умолчанию (ru-RU).
          </Text>
        ) : (
          displayVoices.map(voice => {
            const selected = selectedVoiceId === voice.id;
            return (
              <TouchableOpacity
                key={voice.id}
                testID={`jarvis-voice-option-${voice.id}`}
                style={styles.voiceRow}
                onPress={() => setVoiceId(voice.id)}
              >
                <View>
                  <Text style={styles.body}>{voice.name}</Text>
                  <Text style={styles.meta}>
                    {`${voice.locale} · ${voice.networkRequired ? 'сетевой' : 'офлайн'}`}
                  </Text>
                </View>
                <Icon
                  name={selected ? 'check-circle' : 'circle'}
                  size={16}
                  color={selected ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Распознавание речи (STT)</Text>
        <Text style={styles.body} testID="jarvis-voice-stt-summary">
          {describeVoicePanelStt(downloadedSttId, sttLanguage, sttInfo, showRemoteModels)}
        </Text>
        <TouchableOpacity
          testID="jarvis-voice-open-stt-models"
          style={styles.primaryButton}
          onPress={() =>
            (
              navigation as
                | { navigate?: (name: string, params?: Record<string, unknown>) => void }
                | undefined
            )?.navigate?.('Main', {
              screen: 'ModelsTab',
              params: { initialTab: 'transcription' },
            })
          }
        >
          <Icon name="mic" size={15} color={colors.onPrimary} />
          <Text style={styles.primaryButtonText}>Модели распознавания (Whisper / Qwen3-ASR)</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
