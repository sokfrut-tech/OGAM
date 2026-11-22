import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Feather';
import { Card } from '../components';
import { ScreenHeader } from '../components/ScreenHeader';
import { TouchableOpacity } from '../components/Touchable';
import { SPACING } from '../constants';
import { useTheme } from '../theme';
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
  gguf: 'GGUF · LLM',
  litert: 'LiteRT model',
  mmproj: 'Vision projector',
  whisper: 'Whisper speech model',
  'qnn-model': 'QNN model weight',
  'qnn-runtime': 'QNN runtime library',
  'mnn-model': 'MNN model weight',
  lora: 'LoRA adapter',
  safetensors: 'Safetensors',
  manifest: 'Model manifest',
  unknown: 'Unknown file',
})[kind];

export const LocalModelsScreen: React.FC = () => {
  const navigation = useNavigation<Navigation>();
  const { colors } = useTheme();
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
        const mmProj = mmProjName
          ? artifacts.find(item => item.name === mmProjName)
          : undefined;
        const mmProjUri = mmProj
          ? await nativeDirectorySourceBoundary.documentUri(grant, mmProj.sourceId)
          : undefined;
        await modelManager.importLocalModel({
          sourceUri: uri,
          fileName: artifact.name,
          sourceSize: artifact.fileSize,
          ...(mmProj && mmProjUri ? {
            mmProjSourceUri: mmProjUri,
            mmProjFileName: mmProj.name,
            mmProjSourceSize: mmProj.fileSize,
          } : {}),
          onProgress: progress => setImportProgress(progress.fraction),
        });
      } else if (artifact.kind === 'whisper') {
        await importWhisperModelFromUri(uri, artifact.name);
      } else {
        throw new Error('This artifact is not a standalone model. Its full pack and runtime compatibility must be validated first.');
      }
      await refreshInventory();
      Alert.alert('Import complete', `${artifact.name} is now available in the local model library.`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      Alert.alert('Import failed', message);
    } finally {
      setImportingName(null);
      setImportProgress(0);
    }
  }, [artifacts, grant, importingName, refreshInventory]);

  const textModels = inventory?.textModels ?? [];
  const imageModels = inventory?.imageModels ?? [];
  const whisperModels = inventory?.whisperModels ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Local model library" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: SPACING.xl, paddingBottom: SPACING.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>On this phone</Text>
          <TouchableOpacity onPress={() => void refreshInventory()} accessibilityRole="button" accessibilityLabel="Refresh local model inventory" testID="local-models-refresh">
            {scanning ? <ActivityIndicator color={colors.primary} /> : <Icon name="refresh-cw" size={19} color={colors.primary} />}
          </TouchableOpacity>
        </View>
        <Card style={{ marginBottom: SPACING.lg, padding: SPACING.md }}>
          <Text style={{ color: colors.textSecondary, marginBottom: SPACING.sm }}>
            {textModels.length} text · {imageModels.length} image · {whisperModels.length} speech models
          </Text>
          {textModels.map(({ model, estimatedRamBytes, ggufArchitecture }) => (
            <View key={model.id} style={{ paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.text, fontWeight: '500' }} numberOfLines={1}>{model.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {model.quantization} · file {formatBytes(model.fileSize)} · estimated RAM {formatBytes(estimatedRamBytes)}
                {ggufArchitecture ? ` · ${ggufArchitecture}` : ''}
              </Text>
            </View>
          ))}
          {whisperModels.map(model => (
            <View key={model.filePath} style={{ paddingVertical: SPACING.sm }}>
              <Text style={{ color: colors.text }} numberOfLines={1}>{model.modelId}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Whisper · {formatBytes(model.sizeBytes)}</Text>
            </View>
          ))}
          {imageModels.map(model => (
            <View key={model.id} style={{ paddingVertical: SPACING.sm }}>
              <Text style={{ color: colors.text }} numberOfLines={1}>{model.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{model.backend.toUpperCase()} · {formatBytes(model.size)}</Text>
            </View>
          ))}
          {!inventory && !scanning ? <Text style={{ color: colors.textMuted }}>No local inventory loaded yet.</Text> : null}
        </Card>

        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600', marginBottom: SPACING.sm }}>Scan another folder</Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 20, marginBottom: SPACING.md }}>
          Choose a folder through Android’s system picker. The scanner reads file names and sizes without copying multi-gigabyte weights. Individual GGUF, LiteRT and Whisper files can then be imported explicitly.
        </Text>
        <TouchableOpacity
          onPress={() => void chooseFolder()}
          disabled={scanning || !!importingName}
          accessibilityRole="button"
          accessibilityLabel="Choose folder and scan model files"
          testID="local-models-choose-folder"
          style={{ minHeight: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, marginBottom: SPACING.md }}
        >
          {scanning ? <ActivityIndicator color={colors.primary} /> : <Icon name="folder-search" size={18} color={colors.primary} />}
          <Text style={{ color: colors.text, fontWeight: '600' }}>Choose folder</Text>
        </TouchableOpacity>

        {error ? <Text accessibilityRole="alert" style={{ color: colors.error, marginBottom: SPACING.md }}>{error}</Text> : null}
        {artifacts.map(artifact => {
          const isImportable = artifact.installable && ['gguf', 'litert', 'whisper'].includes(artifact.kind);
          const busy = importingName === artifact.name;
          return (
            <Card key={artifact.sourceId} style={{ padding: SPACING.md, marginBottom: SPACING.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                <Icon name={artifact.kind === 'gguf' || artifact.kind === 'litert' ? 'cpu' : artifact.kind === 'whisper' ? 'mic' : 'file'} size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '500' }} numberOfLines={1}>{artifact.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{kindLabel(artifact.kind)} · {formatBytes(artifact.fileSize)}</Text>
                </View>
                {isImportable ? (
                  <TouchableOpacity
                    onPress={() => void importArtifact(artifact)}
                    disabled={!!importingName}
                    accessibilityRole="button"
                    accessibilityLabel={`Import ${artifact.name}`}
                    testID={`local-model-import-${artifact.name}`}
                    style={{ padding: SPACING.sm }}
                  >
                    {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={{ color: colors.primary, fontWeight: '600' }}>Import</Text>}
                  </TouchableOpacity>
                ) : null}
              </View>
              {busy ? (
                <View style={{ marginTop: SPACING.sm }}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }}>
                    <View style={{ height: 4, width: `${Math.round(importProgress * 100)}%`, backgroundColor: colors.primary }} />
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{Math.round(importProgress * 100)}%</Text>
                </View>
              ) : !isImportable ? (
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: SPACING.xs }}>Companion or runtime artifact — not imported alone.</Text>
              ) : null}
            </Card>
          );
        })}
        {grant && artifacts.length === 0 ? <Text style={{ color: colors.textMuted }}>No supported model files were found in this folder.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
};
