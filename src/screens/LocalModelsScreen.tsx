import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';
import { Card } from '../components';
import { ScreenHeader } from '../components/ScreenHeader';
import { TouchableOpacity } from '../components/Touchable';
import { SPACING } from '../constants';
import { useTheme, useThemedStyles } from '../theme';
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
import { createStyles } from './LocalModelsScreen.styles';

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
})[kind];

export const LocalModelsScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [inventory, setInventory] = useState<LocalModelInventory | null>(null);
  const [grant, setGrant] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<ScannedModelArtifact[]>([]);
  const [scanning, setScanning] = useState(false);
  const [importingName, setImportingName] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refreshInventory = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      setInventory(await scanAppModelInventory());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    void refreshInventory();
  }, [refreshInventory]);

  const chooseFolder = useCallback(async () => {
    if (Platform.OS !== 'android') {
      Alert.alert(t('models.folderScanTitle'), t('models.folderScanBody'));
      return;
    }
    setScanning(true);
    setError(null);
    try {
      const selected = await nativeDirectorySourceBoundary.authorize();
      if (!selected) return;
      const found = await scanSelectedModelDirectory(selected);
      setGrant(selected);
      setArtifacts(found);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setScanning(false);
    }
  }, []);

  const importArtifact = useCallback(async (artifact: ScannedModelArtifact) => {
    if (!grant || !artifact.installable || importingName) return;
    setImportingName(artifact.name);
    setImportProgress(0);
    setError(null);
    try {
      const uri = await nativeDirectorySourceBoundary.documentUri(grant, artifact.sourceId);
      if (artifact.kind === 'gguf' || artifact.kind === 'litert') {
        const mmProjName = artifact.kind === 'gguf'
          ? pickMmProjForModel(artifact.name, artifacts.map(item => item.name))
          : undefined;
        const mmProj = mmProjName ? artifacts.find(item => item.name === mmProjName) : undefined;
        const mmProjUri = mmProj
          ? await nativeDirectorySourceBoundary.documentUri(grant, mmProj.sourceId)
          : undefined;
        await modelManager.importLocalModel({
          sourceUri: uri,
          fileName: artifact.name,
          sourceSize: artifact.fileSize > 0 ? artifact.fileSize : null,
          ...(mmProj && mmProjUri ? {
            mmProjSourceUri: mmProjUri,
            mmProjFileName: mmProj.name,
            mmProjSourceSize: mmProj.fileSize > 0 ? mmProj.fileSize : null,
          } : {}),
          onProgress: progress => setImportProgress(progress.fraction),
        });
      } else if (artifact.kind === 'whisper') {
        await importWhisperModelFromUri(uri, artifact.name);
        await useWhisperStore.getState().refreshPresentModels();
      } else {
        throw new Error(t('models.notStandalone'));
      }
      await refreshInventory();
      Alert.alert(t('models.importComplete'), `${artifact.name} ${t('models.importAvailable')}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      Alert.alert(t('models.importFailed'), message);
    } finally {
      setImportingName(null);
      setImportProgress(0);
    }
  }, [artifacts, grant, importingName, refreshInventory]);

  const textModels = inventory?.textModels ?? [];
  const imageModels = inventory?.imageModels ?? [];
  const whisperModels = inventory?.whisperModels ?? [];
  const importProgressStyle = useMemo(() => ({ width: `${Math.round(importProgress * 100)}%` }), [importProgress]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={t('models.localLibrary')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>{t('models.onPhone')}</Text>
          <TouchableOpacity onPress={() => void refreshInventory()} accessibilityRole="button" accessibilityLabel={t('models.refresh')} testID="local-models-refresh">
            {scanning ? <ActivityIndicator color={colors.primary} /> : <Icon name="refresh-cw" size={19} color={colors.primary} />}
          </TouchableOpacity>
        </View>
        <Card style={styles.card}>
          <Text style={styles.countText}>
            {t('models.counts', { text: textModels.length, image: imageModels.length, whisper: whisperModels.length })}
          </Text>
          {textModels.map(({ model, estimatedRamBytes, ggufArchitecture }) => (
            <View key={model.id} style={styles.modelRow}>
              <Text style={styles.modelName} numberOfLines={1}>{model.name}</Text>
              <Text style={styles.modelMeta}>
                {model.quantization} · {t('models.fileSize')} {formatBytes(model.fileSize)} · {t('models.estimatedRam')} {formatBytes(estimatedRamBytes)}
                {ggufArchitecture ? ` · ${ggufArchitecture}` : ''}
              </Text>
            </View>
          ))}
          {whisperModels.map(model => (
            <View key={model.filePath} style={styles.modelRowSimple}>
              <Text style={styles.modelName} numberOfLines={1}>{model.modelId}</Text>
              <Text style={styles.modelMeta}>{t('models.kind.whisper')} · {formatBytes(model.sizeBytes)}</Text>
            </View>
          ))}
          {imageModels.map(model => (
            <View key={model.id} style={styles.modelRowSimple}>
              <Text style={styles.modelName} numberOfLines={1}>{model.name}</Text>
              <Text style={styles.modelMeta}>{model.backend.toUpperCase()} · {formatBytes(model.size)}</Text>
            </View>
          ))}
          {!inventory && !scanning ? <Text style={styles.noFiles}>{t('models.noInventory')}</Text> : null}
        </Card>

        <Text style={styles.scanTitle}>{t('models.scanFolder')}</Text>
        <Text style={styles.scanDescription}>
          {t('models.scanDescription')}
        </Text>
        <TouchableOpacity
          onPress={() => void chooseFolder()}
          disabled={scanning || !!importingName}
          accessibilityRole="button"
          accessibilityLabel={t('models.chooseFolder')}
          testID="local-models-choose-folder"
          style={styles.chooseButton}
        >
          {scanning ? <ActivityIndicator color={colors.primary} /> : <Icon name="folder" size={18} color={colors.primary} />}
          <Text style={styles.chooseButtonText}>{t('models.chooseFolder')}</Text>
        </TouchableOpacity>

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {artifacts.map(artifact => {
          const isImportable = artifact.installable && ['gguf', 'litert', 'whisper'].includes(artifact.kind);
          const busy = importingName === artifact.name;
          return (
            <Card key={artifact.sourceId} style={styles.artifactCard}>
              <View style={styles.artifactRow}>
                <Icon name={artifact.kind === 'gguf' || artifact.kind === 'litert' ? 'cpu' : artifact.kind === 'whisper' ? 'mic' : 'file'} size={18} color={colors.primary} />
                <View style={styles.artifactInfo}>
                  <Text style={styles.modelName} numberOfLines={1}>{artifact.name}</Text>
                  <Text style={styles.modelMeta}>{kindLabel(artifact.kind)} · {formatBytes(artifact.fileSize)}</Text>
                </View>
                {isImportable ? (
                  <TouchableOpacity
                    onPress={() => void importArtifact(artifact)}
                    disabled={!!importingName}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('models.import')} ${artifact.name}`}
                    testID={`local-model-import-${artifact.name}`}
                    style={styles.importButton}
                  >
                    {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.importText}>{t('models.import')}</Text>}
                  </TouchableOpacity>
                ) : null}
              </View>
              {busy ? (
                <View style={styles.progressContainer}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, importProgressStyle]} />
                  </View>
                  <Text style={styles.progressLabel}>{Math.round(importProgress * 100)}%</Text>
                </View>
              ) : !isImportable ? (
                <Text style={styles.artifactOnly}>{t('models.artifactOnly')}</Text>
              ) : null}
            </Card>
          );
        })}
        {grant && artifacts.length === 0 ? <Text style={styles.noFiles}>{t('models.noSupportedFiles')}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
};
