import React, { useEffect, useState } from 'react';
import DeviceInfoNative from 'react-native-device-info';
import { TouchableOpacity } from '../components/Touchable';
import { jarvisMemoryDatabase } from '../services/jarvisMemory/database';
import { jarvisMemoryRepository } from '../services/jarvisMemory/repository';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { AliveScreen } from '../components/AliveScreen';
import { ScreenHeader } from '../components/ScreenHeader';
import { SectionLabel } from '../components/SectionLabel';
import { useNavigation } from '@react-navigation/native';
import { Card } from '../components';
import { useThemedStyles } from '../theme';
import type { ThemeColors, ThemeShadows } from '../theme';
import { FONTS, TYPOGRAPHY, SPACING } from '../constants';
import { useAppStore } from '../stores';
import { hardwareService } from '../services';

export const DeviceInfoScreen: React.FC = () => {
  const navigation = useNavigation();
  const { deviceInfo } = useAppStore();
  const styles = useThemedStyles(createStyles);

  const totalRamGB = hardwareService.getTotalMemoryGB();
  const deviceTier = hardwareService.getDeviceTier();

  // Live per-process memory (os_proc): available, footprint, and the derived LIMIT.
  // The LIMIT (available + footprint) is what iOS actually caps this app at — the real
  // reason a model can be refused on a high-RAM device. Total RAM alone is misleading.
  const [proc, setProc] = useState<{ availableMB: number; footprintMB: number; limitMB: number } | null>(null);
  useEffect(() => {
    let alive = true;
    hardwareService.getProcessMemory()
      .then((p) => { if (alive) setProc(p); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  const gb = (mb: number) => `${(mb / 1024).toFixed(1)} GB`;

  const [isRunningMemoryProbe, setIsRunningMemoryProbe] = useState(false);
  const [memoryProbeLines, setMemoryProbeLines] = useState<string[]>([]);
  const isM1ValidationBuild = DeviceInfoNative.getBundleId().endsWith('.m1validation');

  const runNativeMemoryProbe = async () => {
    if (isRunningMemoryProbe) return;
    setIsRunningMemoryProbe(true);
    setMemoryProbeLines(['Running native op-sqlite checks…']);
    const lines: string[] = [];
    let probeRecordId: string | null = null;
    let db: ReturnType<typeof jarvisMemoryDatabase.getDatabase> | null = null;
    try {
      await jarvisMemoryDatabase.ensureReady();
      db = jarvisMemoryDatabase.getDatabase();

      const versionRows = (db.executeSync(
        'SELECT sqlite_version() AS version',
      ).rows ?? []) as unknown as Array<{ version: string }>;
      const sqliteVersion = versionRows[0]?.version;
      if (!sqliteVersion) throw new Error('SQLite did not return its runtime version.');
      lines.push('PASS · Native SQLite ' + sqliteVersion);

      try {
        const jsonRows = (db.executeSync(
          'SELECT json_valid(?) AS valid',
          ['{"jarvis":true}'],
        ).rows ?? []) as unknown as Array<{ valid: number }>;
        lines.push(Number(jsonRows[0]?.valid) === 1
          ? 'PASS · JSON1 available'
          : 'INFO · JSON1 returned false (not required by M1)');
      } catch {
        lines.push('INFO · JSON1 extension unavailable (not required by M1)');
      }

      const fkRows = (db.executeSync('PRAGMA foreign_keys').rows ?? []) as unknown as Array<{ foreign_keys: number }>;
      lines.push('INFO · foreign_keys=' + String(fkRows[0]?.foreign_keys ?? 'unknown'));

      const nonce = Date.now().toString() + '-' + Math.random().toString(36).slice(2);
      const created = await jarvisMemoryRepository.createProposal({
        kind: 'fact',
        subject: 'Jarvis M1 native acceptance probe',
        predicate: 'temporary_probe',
        value: { nonce },
        scope: 'global',
      });
      probeRecordId = created.id;
      if (created.status !== 'proposed') throw new Error('New native proposal did not start as proposed.');
      const readBack = await jarvisMemoryRepository.getById(created.id);
      if (!readBack || (readBack.value as { nonce?: string }).nonce !== nonce) {
        throw new Error('Native op-sqlite insert/read round-trip failed.');
      }
      lines.push('PASS · Insert and read through repository');

      if (!(await jarvisMemoryRepository.confirmProposal(created.id))) {
        throw new Error('Native proposal confirmation did not update one row.');
      }
      const confirmed = await jarvisMemoryRepository.list({ scope: 'global', status: 'confirmed' });
      if (!confirmed.some(record => record.id === created.id)) {
        throw new Error('Confirmed proposal was not returned by scoped native query.');
      }
      lines.push('PASS · Confirm and scoped read');

      db.executeSync('CREATE TEMP TABLE IF NOT EXISTS jarvis_memory_m1_probe (value TEXT NOT NULL)');
      db.executeSync('DELETE FROM jarvis_memory_m1_probe');
      db.executeSync('SAVEPOINT jarvis_memory_m1_rollback');
      db.executeSync('INSERT INTO jarvis_memory_m1_probe (value) VALUES (?)', ['must-rollback']);
      db.executeSync('ROLLBACK TO SAVEPOINT jarvis_memory_m1_rollback');
      db.executeSync('RELEASE SAVEPOINT jarvis_memory_m1_rollback');
      const rollbackRows = (db.executeSync(
        'SELECT COUNT(*) AS count FROM jarvis_memory_m1_probe',
      ).rows ?? []) as unknown as Array<{ count: number }>;
      if (Number(rollbackRows[0]?.count) !== 0) {
        throw new Error('Native SQLite savepoint rollback left an inserted row.');
      }
      lines.push('PASS · Native savepoint rollback');
      lines.push('PASS · All required M1 native checks completed');
      setMemoryProbeLines(lines);
    } catch (error) {
      lines.push('FAIL · ' + (error instanceof Error ? error.message : String(error)));
      setMemoryProbeLines(lines);
    } finally {
      if (db) {
        try {
          if (probeRecordId) db.executeSync('DELETE FROM memory_records WHERE id = ?', [probeRecordId]);
          db.executeSync('DROP TABLE IF EXISTS jarvis_memory_m1_probe');
        } catch (cleanupError) {
          lines.push('WARN · Probe cleanup: ' + (cleanupError instanceof Error ? cleanupError.message : String(cleanupError)));
          setMemoryProbeLines([...lines]);
        }
      }
      setIsRunningMemoryProbe(false);
    }
  };


  return (
    <AliveScreen style={styles.container}>
      <ScreenHeader title="Device information" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <SectionLabel title="Hardware" />
        <Card style={styles.section}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Model</Text>
            <Text style={styles.infoValue}>{deviceInfo?.deviceModel}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>System</Text>
            <Text style={styles.infoValue}>
              {deviceInfo?.systemName} {deviceInfo?.systemVersion}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Memory</Text>
            <Text style={styles.infoValue}>{totalRamGB.toFixed(1)} GB</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Free now</Text>
            <Text style={styles.infoValue}>{proc ? gb(proc.availableMB) : '…'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Used by Off Grid AI</Text>
            <Text style={styles.infoValue}>{proc ? gb(proc.footprintMB) : '…'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Off Grid AI can use up to</Text>
            <Text style={styles.infoValue}>{proc ? gb(proc.limitMB) : '…'}</Text>
          </View>
          <View style={[styles.infoRow, styles.lastRow]}>
            <Text style={styles.infoLabel}>Phone class</Text>
            <Text style={[styles.infoValue, styles.tierBadge]}>
              {deviceTier.charAt(0).toUpperCase() + deviceTier.slice(1)}
            </Text>
          </View>
        </Card>

        {isM1ValidationBuild ? (
          <Card style={styles.section}>
            <Text style={styles.description}>Temporary M1 acceptance tool. It tests the bundled native op-sqlite runtime, not a mocked database.</Text>
            <TouchableOpacity
              onPress={runNativeMemoryProbe}
              disabled={isRunningMemoryProbe}
              accessibilityRole="button"
              accessibilityLabel="Run Jarvis memory native SQLite validation"
              style={{ paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, borderRadius: 8, backgroundColor: colors.primary, opacity: isRunningMemoryProbe ? 0.6 : 1 }}
            >
              <Text style={{ color: '#FFFFFF', textAlign: 'center', fontWeight: '600' }}>
                {isRunningMemoryProbe ? 'Testing native SQLite…' : 'Run native SQLite test'}
              </Text>
            </TouchableOpacity>
            {memoryProbeLines.map((line, index) => (
              <Text key={index} style={{ ...TYPOGRAPHY.bodySmall, color: colors.text, marginTop: SPACING.sm }}>
                {line}
              </Text>
            ))}
          </Card>
        ) : null}

        <SectionLabel title="What runs here" />
        <Card style={styles.section}>
          <Text style={styles.description}>
            Your device tier determines which models will run smoothly. Higher RAM allows larger, more capable models.
          </Text>

          <View style={styles.tierInfo}>
            <View style={[styles.tierItem, deviceTier === 'low' && styles.tierItemActive]}>
              <Text style={[styles.tierName, deviceTier === 'low' && styles.tierNameActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Low</Text>
              <Text style={styles.tierDesc}>Under 4 GB</Text>
              <Text style={styles.tierModels}>Quick chats with small models</Text>
            </View>
            <View style={[styles.tierItem, styles.tierDivider, deviceTier === 'medium' && styles.tierItemActive]}>
              <Text style={[styles.tierName, deviceTier === 'medium' && styles.tierNameActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Medium</Text>
              <Text style={styles.tierDesc}>4 to 6 GB</Text>
              <Text style={styles.tierModels}>Everyday chat and pictures</Text>
            </View>
            <View style={[styles.tierItem, styles.tierDivider, deviceTier === 'high' && styles.tierItemActive]}>
              <Text style={[styles.tierName, deviceTier === 'high' && styles.tierNameActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>High</Text>
              <Text style={styles.tierDesc}>6 to 8 GB</Text>
              <Text style={styles.tierModels}>Bigger, smarter chat models</Text>
            </View>
            <View style={[styles.tierItem, styles.tierDivider, deviceTier === 'flagship' && styles.tierItemActive]}>
              <Text style={[styles.tierName, deviceTier === 'flagship' && styles.tierNameActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>Flagship</Text>
              <Text style={styles.tierDesc}>8 GB or more</Text>
              <Text style={styles.tierModels}>The largest models this app offers</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </AliveScreen>
  );
};

const createStyles = (colors: ThemeColors, shadows: ThemeShadows) => ({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.small,
    zIndex: 1,
    gap: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
  },
  title: {
    ...TYPOGRAPHY.h2,
    flex: 1,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  // The shared section-label style, not a heading per card.
  description: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.lg,
  },
  infoRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    ...TYPOGRAPHY.body,
    color: colors.textSecondary,
  },
  // Numbers and facts in Mono, as everywhere.
  infoValue: {
    ...TYPOGRAPHY.body,
    fontFamily: FONTS.mono,
    color: colors.text,
  },
  tierBadge: {
    ...TYPOGRAPHY.label,
    textTransform: 'uppercase' as const,
    color: colors.textSecondary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
    overflow: 'hidden' as const,
  },
  // Four tiers as hairline rows, not a grid of boxes inside a box (hand tests 61-63). This phone's
  // tier is the grey row.
  tierInfo: {
    flexDirection: 'column' as const,
  },
  tierItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    // Pulled out by its own padding so the names line up with the text above (hand test 65).
    marginHorizontal: -SPACING.sm,
    borderRadius: 6,
  },
  tierDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  tierItemActive: {
    backgroundColor: colors.surfaceLight,
  },
  tierName: {
    ...TYPOGRAPHY.body,
    color: colors.text,
    width: 84,
  },
  // Chosen is the grey fill; the name stays ink (hand test 60: an emerald "Flagship").
  tierNameActive: {
    color: colors.text,
  },
  tierDesc: {
    ...TYPOGRAPHY.meta,
    fontFamily: FONTS.mono,
    color: colors.textMuted,
    width: 84,
  },
  tierModels: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
});
