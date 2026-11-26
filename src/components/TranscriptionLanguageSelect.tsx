import React, { useEffect, useMemo } from 'react';
import { transcriptionLanguages } from '../utils/transcriptionLanguages';
import { useWhisperStore } from '../stores/whisperStore';
import { SettingsOptionSelect } from './SettingsOptionSelect';
import { callHook, HOOKS } from '../bootstrap/hookRegistry';
import { isJarvisStandaloneRuntime } from '../i18n';
import { isQwenAsrModelId } from '../services/qwenAsrModel';
import { isEnglishOnlyWhisperModel } from '../services/whisperModels';

interface TranscriptionLanguageSelectProps {
  testID?: string;
}

/** One language setting for every local speech-to-text entry point. */
export const TranscriptionLanguageSelect: React.FC<TranscriptionLanguageSelectProps> = ({
  testID = 'transcription-language-select',
}) => {
  const downloadedModelId = useWhisperStore((state) => state.downloadedModelId);
  const language = useWhisperStore((state) => state.transcriptionLanguage);
  const setLanguage = useWhisperStore((state) => state.setTranscriptionLanguage);
  const languages = useMemo(
    () => transcriptionLanguages(isQwenAsrModelId(downloadedModelId) ? 'qwen3-asr' : 'whisper', downloadedModelId),
    [downloadedModelId],
  );
  const options = useMemo(
    () => languages.map(({ code, label }) => ({ value: code, label })),
    [languages],
  );
  const supportedValue = options.some((option) => option.value === language)
    ? language
    : options[0]?.value ?? 'en';

  useEffect(() => {
    const keepRuForIncompatibleEnModel =
      isJarvisStandaloneRuntime &&
      language === 'ru' &&
      isEnglishOnlyWhisperModel(downloadedModelId);
    if (!keepRuForIncompatibleEnModel && supportedValue !== language) {
      setLanguage(supportedValue);
    }
  }, [downloadedModelId, language, setLanguage, supportedValue]);

  const selectLanguage = (nextLanguage: string) => {
    setLanguage(nextLanguage);
    if (nextLanguage !== 'auto') {
      callHook(HOOKS.audioSelectLanguage, nextLanguage);
    }
  };

  const englishOnlyDescription = isJarvisStandaloneRuntime
    ? 'Эта модель поддерживает только английский — для русского скачайте Whisper Small (RU) или Qwen3-ASR.'
    : 'This model supports English.';
  const multiDescription = isJarvisStandaloneRuntime
    ? 'Выберите язык речи (рекомендуется русский) или автоопределение.'
    : 'Choose a language or use auto-detect.';

  return (
    <SettingsOptionSelect
      testID={testID}
      label={isJarvisStandaloneRuntime ? 'Язык распознавания речи' : 'Language'}
      value={supportedValue}
      options={options}
      onChange={selectLanguage}
      description={options.length === 1 ? englishOnlyDescription : multiDescription}
    />
  );
};
