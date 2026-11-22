import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, View } from 'react-native';
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
import { modelManager } from '../services/modelManager';
import { nativeDirectorySourceBoundary } from '../services/sync/nativeDirectorySource';
import {
  scanAppModelInventory,
  scanSelectedModelDirectory,
  type LocalModelInventory,
  type ScannedModelArtifact,
} from '../services/modelScannerService';
import { importWhisperModelFromUri } from '../services/whisperModelFiles';
import { useWhisperStore } from '../stores/whisperStore';
import { pickMmProjForModel } from '../services/mmproj';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'LocalModels'>;

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit >= 2 ? 1 : 0)} ${units[unit]}`;
};

const kindLabel = (kind: ScannedModelArtifact['kind']): string => ({
  gguf: t('models.kind.gguf'),
  litert: t('models.kind.litert'),
  mmproj: t('models.kind.mmproj'),
  whisper: t('models.kind.whisper'),
  'qnn-model': t('models.kind.qnnModel'),
  'qnn-runtime': t('models.kind.qnnRuntime'),
  'mnn-model': t('models.kind.mnn'),
  lora: t('models.kind.lora'),
  safetensors: t('models.kind.safetensors'),
  manifest: t('models.kind.manifest'),
  unknown: t('models.kind.manifest'),
});
