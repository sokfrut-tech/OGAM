import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useTheme, useThemedStyles } from '../theme';
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
import { createStyles } from './ImageGenScreen.styles';

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
  const styles = useThemedStyles(createStyles);
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
        Alert.alert(t('image.generationFailed'), imageGenerationService.getState().error || t('image.generationFailed'));
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
  const progressFillStyle = useMemo(() => ({ width: `${progressPercent}%` }), [progressPercent]);
  const resultImageAspectRatioStyle = useMemo(() => imageState.result
    ? { aspectRatio: imageState.result.width / imageState.result.height }
    : undefined, [imageState.result]);
  const generationDisabled = !prompt.trim() || imageState.isGenerating || recording || previewBusy;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={t('image.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          {t('image.intro')}
        </Text>

        <Card style={styles.card}>
          <Text style={styles.fieldTitle}>{t('image.prompt')}</Text>
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            multiline
            textAlignVertical="top"
            placeholder={t('image.promptPlaceholder')}
            placeholderTextColor={colors.textMuted}
            editable={!imageState.isGenerating && !recording}
            accessibilityLabel={t('image.prompt')}
            testID="image-gen-prompt"
            style={styles.promptInput}
          />
          {recording || voicePreview ? (
            <Text style={styles.voicePreview}>
              {recording ? `${t('image.listening')} ` : `${t('image.recognized')} `}{voicePreview}
            </Text>
          ) : null}
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={() => void (recording ? stopVoice() : startVoice())}
              disabled={imageState.isGenerating || previewBusy}
              accessibilityRole="button"
              accessibilityLabel={recording ? t('image.stopDictation') : t('image.dictate')}
              testID="image-gen-voice"
              style={[styles.actionButton, recording && styles.recordingButton]}
            >
              <Icon name={recording ? 'square' : 'mic'} size={16} color={recording ? colors.text : colors.primary} />
              <Text style={styles.actionButtonText}>{recording ? t('image.stopDictation') : t('image.dictate')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void handleEnhance()}
              disabled={!prompt.trim() || previewBusy || imageState.isGenerating || recording}
              accessibilityRole="button"
              accessibilityLabel={t('image.enhancePreview')}
              testID="image-gen-enhance"
              style={styles.actionButton}
            >
              {previewBusy ? <ActivityIndicator color={colors.primary} /> : <Icon name="zap" size={16} color={colors.primary} />}
              <Text style={styles.actionButtonText}>{t('image.enhancePreview')}</Text>
            </TouchableOpacity>
          </View>
          {previewStatus ? <Text style={styles.previewStatus}>{previewStatus}</Text> : null}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.resultTitle}>{t('image.negativePrompt')}</Text>
          <TextInput
            value={negativePrompt}
            onChangeText={setNegativePrompt}
            multiline
            placeholder={t('image.negativePlaceholder')}
            placeholderTextColor={colors.textMuted}
            editable={!imageState.isGenerating}
            testID="image-gen-negative-prompt"
            style={styles.negativeInput}
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.controlsTitle}>{t('image.controls')}</Text>
          <View style={styles.fieldsRow}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('image.steps', { max: MAX_IMAGE_STEPS })}</Text>
              <TextInput value={steps} onChangeText={setSteps} keyboardType="number-pad" editable={!imageState.isGenerating} testID="image-gen-steps" style={styles.fieldInput} />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('image.cfg')}</Text>
              <TextInput value={guidanceScale} onChangeText={setGuidanceScale} keyboardType="decimal-pad" editable={!imageState.isGenerating} testID="image-gen-cfg" style={styles.fieldInput} />
            </View>
          </View>
          <View style={styles.seedField}>
            <Text style={styles.fieldLabel}>{t('image.seed')}</Text>
            <TextInput value={seed} onChangeText={setSeed} keyboardType="number-pad" editable={!imageState.isGenerating} testID="image-gen-seed" placeholder={t('image.random')} placeholderTextColor={colors.textMuted} style={styles.fieldInput} />
          </View>
          <Text style={styles.unsupportedNote}>
            {t('image.unsupported')}
          </Text>
        </Card>

        {imageState.isGenerating ? (
          <Card style={styles.card}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusText}>{imageState.status || t('image.generating')}</Text>
              <TouchableOpacity onPress={cancel} accessibilityRole="button" accessibilityLabel={t('image.cancel')} testID="image-gen-cancel">
                <Icon name="x-circle" size={22} color={colors.error} />
              </TouchableOpacity>
            </View>
            {progress ? (
              <>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, progressFillStyle]} />
                </View>
                <Text style={styles.progressText}>{t('image.progress', { step: progress.step, total: progress.totalSteps, percent: progressPercent })}</Text>
              </>
            ) : null}
          </Card>
        ) : null}

        {imageState.result ? (
          <Card style={styles.card}>
            <Text style={styles.resultTitle}>{t('image.generated')}</Text>
            <Image source={{ uri: `file://${resolveDocumentPath(imageState.result.imagePath)}` }} resizeMode="contain" style={[styles.resultImage, resultImageAspectRatioStyle]} />
            <Text style={styles.resultMeta}>
              {t('image.stepsCount', { width: imageState.result.width, height: imageState.result.height, steps: imageState.result.steps, seed: imageState.result.seed })}
            </Text>
          </Card>
        ) : null}

        {imageState.error ? <Text accessibilityRole="alert" style={styles.error}>{imageState.error}</Text> : null}

        <TouchableOpacity
          onPress={() => void generate()}
          disabled={!prompt.trim() || imageState.isGenerating || recording || previewBusy}
          accessibilityRole="button"
          accessibilityLabel={t('image.generate')}
          testID="image-gen-generate"
          style={[styles.generateButton, generationDisabled && styles.disabled]}
        >
          {imageState.isGenerating ? <ActivityIndicator color={colors.background} /> : <Icon name="image" size={18} color="#FFFFFF" />}
          <Text style={styles.generateButtonText}>{imageState.isGenerating ? t('image.generating') : t('image.generate')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};
