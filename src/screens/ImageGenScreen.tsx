import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';
import { Card } from '../components';
import { ScreenHeader } from '../components/ScreenHeader';
import { TouchableOpacity } from '../components/Touchable';
import { SPACING } from '../constants';
import { useTheme } from '../theme';
import { t } from '../i18n';
import type { RootStackParamList } from '../navigation/types';
import { imageGenerationService } from '../services/imageGenerationService';
import { resolveMobileImageParameters } from '../services/imageParameterPolicy';
import type { ImageGenerationState } from '../services/imageGenerationService';
import { enhanceImagePrompt } from '../services/imagePromptEnhancement';
import { whisperService } from '../services/whisperService';
import { useAppStore } from '../stores/appStore';
import { useWhisperStore } from '../stores/whisperStore';
import { MAX_IMAGE_STEPS } from '../utils/imageGenAdvice';
import { resolveDocumentPath } from '../utils/resolveDocumentPath';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'ImageGen'>;

const INITIAL_STATE: ImageGenerationState = {
  phase: 'idle',
  isGenerating: false,
  progress: null,
  status: null,
  previewPath: null,
  prompt: null,
  conversationId: null,
  messageId: null,
  error: null,
  result: null,
};

export const ImageGenScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const { colors } = useTheme();
  const app = useAppStore();
  const whisper = useWhisperStore();
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const initialModel = app.downloadedImageModels.find(model => model.id === app.activeImageModelId);
  const initialParameters = initialModel
    ? resolveMobileImageParameters(initialModel, app)
    : { steps: app.imageSteps, guidanceScale: app.imageGuidanceScale, size: app.imageWidth ?? 512 };
  const [steps, setSteps] = useState(String(initialParameters.steps));
  const [guidanceScale, setGuidanceScale] = useState(String(initialParameters.guidanceScale));
  const [seed, setSeed] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [voicePreview, setVoicePreview] = useState('');
  const [imageState, setImageState] = useState<ImageGenerationState>(INITIAL_STATE);

  useEffect(() => imageGenerationService.subscribe(setImageState), []);

  useEffect(() => {
    const state = useAppStore.getState();
    const selected = state.downloadedImageModels.find(model => model.id === state.activeImageModelId);
    if (selected) {
      const resolved = resolveMobileImageParameters(selected, state);
      setSteps(String(resolved.steps));
      setGuidanceScale(String(resolved.guidanceScale));
    }
  }, [app.activeImageModelId]);

  useEffect(() => () => {
    if (whisperService.isCurrentlyTranscribing()) {
      void whisperService.stopTranscription();
    }
  }, []);

  const handleEnhance = useCallback(async () => {
    if (!prompt.trim() || previewBusy || imageState.isGenerating) return;
    setPreviewBusy(true);
    setPreviewStatus(t('image.enhancing'));
    try {
      const enhanced = await enhanceImagePrompt(
        { prompt: prompt.trim() },
        setPreviewStatus,
        () => false,
        true,
      );
      setPrompt(enhanced);
      setPreviewStatus(t('image.previewReady'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPreviewStatus(t('image.enhancementUnavailable', { error: message }));
    } finally {
      setPreviewBusy(false);
    }
  }, [imageState.isGenerating, previewBusy, prompt]);

  const startVoice = useCallback(async () => {
    if (recording || previewBusy || imageState.isGenerating) return;
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    if (!whisper.downloadedModelId) {
      Alert.alert(t('image.whisperRequiredTitle'), t('image.whisperRequiredBody'));
      navigation.navigate('Main', { screen: 'ModelsTab', params: { initialTab: 'voice' } });
      return;
    }
    try {
      const loadResult = await useWhisperStore.getState().loadModel();
      if (loadResult !== 'loaded') {
        Alert.alert(
          t('image.whisperNotReady'),
          loadResult === 'blocked'
            ? t('image.whisperMemoryBlocked')
            : (useWhisperStore.getState().error || 'Whisper could not be loaded.'),
        );
        return;
      }
      setVoicePreview('');
      setRecording(true);
      await whisperService.startRealtimeTranscription(
        result => {
          setVoicePreview(result.text);
          if (!result.isCapturing) {
            setRecording(false);
            if (result.text.trim()) {
              setPrompt(current => [current.trim(), result.text.trim()].filter(Boolean).join(' '));
            }
            setVoicePreview('');
          }
        },
        { language: useWhisperStore.getState().transcriptionLanguage },
      );
    } catch (error) {
      setRecording(false);
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert(t('image.voiceFailed'), message);
    }
  }, [imageState.isGenerating, navigation, previewBusy, recording, whisper.downloadedModelId]);

  const stopVoice = useCallback(async () => {
    if (!recording) return;
    try {
      await whisperService.stopTranscription();
    } catch (error) {
      setRecording(false);
      Alert.alert(t('image.stopVoiceFailed'), error instanceof Error ? error.message : String(error));
    }
  }, [recording]);

  const generate = useCallback(async () => {
    const finalPrompt = prompt.trim();
    if (!finalPrompt || imageState.isGenerating || recording || previewBusy) return;
    const parsedSteps = Number(steps);
    const parsedGuidance = Number(guidanceScale);
    const parsedSeed = seed.trim() ? Number(seed) : undefined;
    if (!Number.isInteger(parsedSteps) || parsedSteps < 4 || parsedSteps > MAX_IMAGE_STEPS) {
      Alert.alert(t('image.invalidStepsTitle'), t('image.invalidSteps', { max: MAX_IMAGE_STEPS }));
      return;
    }
    if (!Number.isFinite(parsedGuidance) || parsedGuidance <= 0 || parsedGuidance > 30) {
      Alert.alert(t('image.invalidCfgTitle'), t('image.invalidCfg'));
      return;
    }
    if (seed.trim() && (!Number.isInteger(parsedSeed) || parsedSeed! < 0)) {
      Alert.alert(t('image.invalidSeedTitle'), t('image.invalidSeed'));
      return;
    }
    try {
      const result = await imageGenerationService.generateImage({
        prompt: finalPrompt,
        negativePrompt: negativePrompt.trim() || undefined,
        steps: parsedSteps,
        guidanceScale: parsedGuidance,
        seed: parsedSeed,
        promptIsFinal: true,
      });
      if (!result && imageGenerationService.getState().error) {
        Alert.alert(t('image.generationFailed'), imageGenerationService.getState().error || 'Unknown error');
      }
    } catch (error) {
      Alert.alert(t('image.generationFailed'), error instanceof Error ? error.message : String(error));
    }
  }, [guidanceScale, imageState.isGenerating, negativePrompt, previewBusy, prompt, recording, seed, steps]);

  const cancel = useCallback(() => {
    void imageGenerationService.cancelGeneration();
  }, []);

  const progress = imageState.progress;
  const progressPercent = progress && progress.totalSteps > 0
    ? Math.round((progress.step / progress.totalSteps) * 100)
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title={t('image.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SPACING.xl, paddingBottom: SPACING.xxl }}>
        <Text style={{ color: colors.textSecondary, marginBottom: SPACING.md }}>
          {t('image.intro')}
        </Text>

        <Card style={{ padding: SPACING.md, marginBottom: SPACING.md }}>
          <Text style={{ color: colors.text, fontWeight: '600', marginBottom: SPACING.sm }}>{t('image.prompt')}</Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            multiline
            textAlignVertical="top"
            placeholder={t('image.promptPlaceholder')}
            placeholderTextColor={colors.textMuted}
            editable={!imageState.isGenerating && !recording}
            accessibilityLabel="Image prompt"
            testID="image-gen-prompt"
            style={{ minHeight: 120, color: colors.text, fontSize: 15, lineHeight: 22, padding: SPACING.sm, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
          />
          {recording || voicePreview ? (
            <Text style={{ color: colors.primary, marginTop: SPACING.sm }}>
              {recording ? t('image.listening') + ' ' : t('image.recognized') + ' '}{voicePreview}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.md }}>
            <TouchableOpacity
              onPress={() => void (recording ? stopVoice() : startVoice())}
              disabled={imageState.isGenerating || previewBusy}
              accessibilityRole="button"
              accessibilityLabel={recording ? 'Stop voice dictation' : 'Start voice dictation'}
              testID="image-gen-voice"
              style={{ minHeight: 42, paddingHorizontal: SPACING.md, borderRadius: 10, backgroundColor: recording ? colors.error : colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs }}
            >
              <Icon name={recording ? 'square' : 'mic'} size={16} color={recording ? '#FFFFFF' : colors.primary} />
              <Text style={{ color: recording ? '#FFFFFF' : colors.text, fontWeight: '600' }}>{recording ? t('image.stopDictation') : t('image.dictate')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void handleEnhance()}
              disabled={!prompt.trim() || previewBusy || imageState.isGenerating || recording}
              accessibilityRole="button"
              accessibilityLabel="Enhance and preview prompt"
              testID="image-gen-enhance"
              style={{ minHeight: 42, paddingHorizontal: SPACING.md, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs }}
            >
              {previewBusy ? <ActivityIndicator color={colors.primary} /> : <Icon name="zap" size={16} color={colors.primary} />}
              <Text style={{ color: colors.text, fontWeight: '600' }}>Enhance preview</Text>
            </TouchableOpacity>
          </View>
          {previewStatus ? <Text style={{ color: colors.textSecondary, marginTop: SPACING.sm, fontSize: 12 }}>{previewStatus}</Text> : null}
        </Card>

        <Card style={{ padding: SPACING.md, marginBottom: SPACING.md }}>
          <Text style={{ color: colors.text, fontWeight: '600', marginBottom: SPACING.sm }}>{t('image.negativePrompt')}</Text>
          <TextInput
            value={negativePrompt}
            onChangeText={setNegativePrompt}
            multiline
            placeholder={t('image.negativePlaceholder')}
            placeholderTextColor={colors.textMuted}
            editable={!imageState.isGenerating}
            testID="image-gen-negative-prompt"
            style={{ minHeight: 68, color: colors.text, fontSize: 14, padding: SPACING.sm, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}
          />
        </Card>

        <Card style={{ padding: SPACING.md, marginBottom: SPACING.md }}>
          <Text style={{ color: colors.text, fontWeight: '600', marginBottom: SPACING.md }}>{t('image.controls')}</Text>
          <View style={{ flexDirection: 'row', gap: SPACING.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 6 }}>{t('image.steps', { max: MAX_IMAGE_STEPS })}</Text>
              <TextInput value={steps} onChangeText={setSteps} keyboardType="number-pad" editable={!imageState.isGenerating} testID="image-gen-steps" style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: SPACING.sm }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, marginBottom: 6 }}>{t('image.cfg')}</Text>
              <TextInput value={guidanceScale} onChangeText={setGuidanceScale} keyboardType="decimal-pad" editable={!imageState.isGenerating} testID="image-gen-cfg" style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: SPACING.sm }} />
            </View>
          </View>
          <View style={{ marginTop: SPACING.md }}>
            <Text style={{ color: colors.textSecondary, marginBottom: 6 }}>{t('image.seed')}</Text>
            <TextInput value={seed} onChangeText={setSeed} keyboardType="number-pad" editable={!imageState.isGenerating} testID="image-gen-seed" placeholder={t('image.random')} placeholderTextColor={colors.textMuted} style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: SPACING.sm }} />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: SPACING.md, lineHeight: 18 }}>
            {t('image.unsupported')}
          </Text>
        </Card>

        {imageState.isGenerating ? (
          <Card style={{ padding: SPACING.md, marginBottom: SPACING.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{imageState.status || 'Generating image…'}</Text>
              <TouchableOpacity onPress={cancel} accessibilityRole="button" accessibilityLabel={t('image.cancel')} testID="image-gen-cancel">
                <Icon name="x-circle" size={22} color={colors.error} />
              </TouchableOpacity>
            </View>
            {progress ? (
              <>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', marginTop: SPACING.md }}>
                  <View style={{ height: 6, width: `${progressPercent}%`, backgroundColor: colors.primary }} />
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: SPACING.xs }}>{t('image.progress', { step: progress.step, total: progress.totalSteps, percent: progressPercent })}</Text>
              </>
            ) : null}
          </Card>
        ) : null}

        {imageState.result ? (
          <Card style={{ padding: SPACING.md, marginBottom: SPACING.md }}>
            <Text style={{ color: colors.text, fontWeight: '600', marginBottom: SPACING.sm }}>{t('image.generated')}</Text>
            <Image source={{ uri: `file://${resolveDocumentPath(imageState.result.imagePath)}` }} resizeMode="contain" style={{ width: '100%', aspectRatio: imageState.result.width / imageState.result.height, borderRadius: 10 }} />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: SPACING.sm }}>
              {t('image.stepsCount', { width: imageState.result.width, height: imageState.result.height, steps: imageState.result.steps, seed: imageState.result.seed })}
            </Text>
          </Card>
        ) : null}

        {imageState.error ? <Text accessibilityRole="alert" style={{ color: colors.error, marginBottom: SPACING.md }}>{imageState.error}</Text> : null}

        <TouchableOpacity
          onPress={() => void generate()}
          disabled={!prompt.trim() || imageState.isGenerating || recording || previewBusy}
          accessibilityRole="button"
          accessibilityLabel={t('image.generate')}
          testID="image-gen-generate"
          style={{ minHeight: 50, borderRadius: 12, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, opacity: !prompt.trim() || imageState.isGenerating || recording || previewBusy ? 0.5 : 1 }}
        >
          {imageState.isGenerating ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="image" size={18} color="#FFFFFF" />}
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{imageState.isGenerating ? t('image.generating') : t('image.generate')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};
