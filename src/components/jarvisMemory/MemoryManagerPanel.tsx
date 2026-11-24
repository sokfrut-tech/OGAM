import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  formatKindLabel,
  formatProvenanceLabel,
  formatValuePreview,
} from '../../services/jarvisMemory/confirmationController';
import {
  MEMORY_KINDS,
  type MemoryExportBundle,
  type MemoryKind,
  type MemoryRecord,
  type MemoryUndoCheckpoint,
} from '../../services/jarvisMemory/types';

export interface MemoryManagerPanelProps {
  memoryEnabled: boolean;
  onToggleEnabled: (nextEnabled: boolean) => void;
  records: MemoryRecord[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  kindFilter: MemoryKind | null;
  onKindFilterChange: (kind: MemoryKind | null) => void;
  latestUndo: MemoryUndoCheckpoint | null;
  onUndo: () => void;
  onEditRecord: (
    record: MemoryRecord,
    nextSubject: string,
    nextPredicate: string,
    nextValue: unknown,
  ) => void | Promise<void>;
  onDeleteRecord: (id: string) => void;
  onExportJson: () => void;
  exportBundle: MemoryExportBundle | null;
  onDismissExport: () => void;
  busy?: boolean;
}

function initialEditValueText(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function parseEditedValue(rawText: string): unknown {
  const trimmed = rawText.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return rawText;
    }
  }
  return rawText;
}

/** Standalone M3 memory manager card: fail-closed switch, Undo banner, scoped search/filter, edit/delete, and portable JSON export. */
export const MemoryManagerPanel: React.FC<MemoryManagerPanelProps> = ({
  memoryEnabled,
  onToggleEnabled,
  records,
  searchQuery,
  onSearchQueryChange,
  kindFilter,
  onKindFilterChange,
  latestUndo,
  onUndo,
  onEditRecord,
  onDeleteRecord,
  onExportJson,
  exportBundle,
  onDismissExport,
  busy = false,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editPredicate, setEditPredicate] = useState('');
  const [editValueText, setEditValueText] = useState('');

  const startEditing = (record: MemoryRecord) => {
    setEditingId(record.id);
    setEditSubject(record.subject);
    setEditPredicate(record.predicate);
    setEditValueText(initialEditValueText(record.value));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditSubject('');
    setEditPredicate('');
    setEditValueText('');
  };

  const handleSaveEdit = async (record: MemoryRecord) => {
    await Promise.resolve(
      onEditRecord(record, editSubject, editPredicate, parseEditedValue(editValueText)),
    );
    cancelEditing();
  };

  return (
    <View style={styles.container}>
      {/* Global fail-closed memory toggle (MEM-026) */}
      <View style={[styles.toggleCard, !memoryEnabled && styles.toggleCardPaused]}>
        <View style={styles.toggleTextWrap}>
          <Text style={styles.toggleTitle}>
            {memoryEnabled ? 'Память активна' : 'Память на паузе (fail-closed)'}
          </Text>
          <Text style={styles.toggleHint}>
            {memoryEnabled
              ? 'Новые предложения и выдача в промпт разрешены.'
              : 'Записи сохранены, но новые сохранения и подмешивание в LLM заблокированы.'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => onToggleEnabled(!memoryEnabled)}
          style={({ pressed }) => [
            styles.toggleButton,
            memoryEnabled ? styles.toggleButtonPause : styles.toggleButtonResume,
            (pressed || busy) && styles.mutedPress,
          ]}
        >
          <Text style={styles.toggleButtonText}>
            {memoryEnabled ? 'Пауза' : 'Включить'}
          </Text>
        </Pressable>
      </View>

      {/* Pre-operation Undo banner */}
      {latestUndo ? (
        <View style={styles.undoBanner}>
          <View style={styles.undoTextWrap}>
            <Text style={styles.undoTitle}>
              {latestUndo.operation === 'delete'
                ? 'Удалена запись'
                : 'Изменена запись'}: {latestUndo.snapshot.subject}
            </Text>
            <Text style={styles.undoSub}>
              Доступен локальный откат предыдущего состояния (1 шаг)
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onUndo}
            style={({ pressed }) => [styles.undoButton, (pressed || busy) && styles.mutedPress]}
          >
            <Text style={styles.undoButtonText}>Отменить</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Scoped search & kind filter (MEM-025) */}
      <View style={styles.searchRow}>
        <TextInput
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          placeholder="Поиск по теме, предикату или значению…"
          placeholderTextColor="#64748B"
          style={styles.searchInput}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onExportJson}
          style={({ pressed }) => [styles.exportButton, (pressed || busy) && styles.mutedPress]}
        >
          <Text style={styles.exportButtonText}>Экспорт JSON</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <Pressable
          onPress={() => onKindFilterChange(null)}
          style={[styles.filterChip, kindFilter === null && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, kindFilter === null && styles.filterChipTextActive]}>
            Все
          </Text>
        </Pressable>
        {MEMORY_KINDS.map(kindItem => (
          <Pressable
            key={kindItem}
            onPress={() => onKindFilterChange(kindItem)}
            style={[styles.filterChip, kindFilter === kindItem && styles.filterChipActive]}
          >
            <Text
              style={[
                styles.filterChipText,
                kindFilter === kindItem && styles.filterChipTextActive,
              ]}
            >
              {formatKindLabel(kindItem)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Portable JSON export preview with unencrypted warning (MEM-020) */}
      {exportBundle ? (
        <View style={styles.exportCard}>
          <View style={styles.exportHeader}>
            <Text style={styles.exportTitle}>
              Экспорт ({exportBundle.recordCount} зап., скрыто секретов: {exportBundle.redactedSecretCount})
            </Text>
            <Pressable onPress={onDismissExport} style={styles.closeExportBtn}>
              <Text style={styles.closeExportText}>Скрыть</Text>
            </Pressable>
          </View>
          <Text style={styles.exportWarning}>{exportBundle.securityWarning}</Text>
          <Text selectable style={styles.exportJson}>
            {JSON.stringify(exportBundle, null, 2)}
          </Text>
        </View>
      ) : null}

      {/* Records list */}
      {records.length === 0 ? (
        <Text style={styles.emptyText}>
          В текущей области нет подтверждённых записей по заданному фильтру.
        </Text>
      ) : (
        records.map(record => {
          const isEditing = editingId === record.id;
          return (
            <View key={record.id} style={styles.recordCard}>
              {isEditing ? (
                <View>
                  <Text style={styles.editLabel}>Тема</Text>
                  <TextInput
                    value={editSubject}
                    onChangeText={setEditSubject}
                    style={styles.editInput}
                  />
                  <Text style={styles.editLabel}>Предикат</Text>
                  <TextInput
                    value={editPredicate}
                    onChangeText={setEditPredicate}
                    style={styles.editInput}
                  />
                  <Text style={styles.editLabel}>Значение</Text>
                  <TextInput
                    value={editValueText}
                    onChangeText={setEditValueText}
                    multiline
                    style={[styles.editInput, styles.editInputMultiline]}
                  />
                  <View style={styles.editActions}>
                    <Pressable
                      disabled={busy}
                      onPress={cancelEditing}
                      style={styles.cancelEditBtn}
                    >
                      <Text style={styles.cancelEditText}>Отмена</Text>
                    </Pressable>
                    <Pressable
                      disabled={busy}
                      onPress={() => void handleSaveEdit(record)}
                      style={styles.saveEditBtn}
                    >
                      <Text style={styles.saveEditText}>Сохранить правку</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View>
                  <View style={styles.recordHeader}>
                    <View style={styles.recordTitleWrap}>
                      <Text style={styles.recordSubject}>{record.subject}</Text>
                      <Text style={styles.recordMeta}>
                        {formatKindLabel(record.kind)} · {record.predicate}
                      </Text>
                    </View>
                    <View style={styles.recordBtns}>
                      <Pressable
                        disabled={busy}
                        onPress={() => startEditing(record)}
                        style={styles.editButton}
                      >
                        <Text style={styles.editBtnText}>Изм.</Text>
                      </Pressable>
                      <Pressable
                        disabled={busy}
                        onPress={() => onDeleteRecord(record.id)}
                        style={styles.deleteButton}
                      >
                        <Text style={styles.deleteBtnText}>Удал.</Text>
                      </Pressable>
                    </View>
                  </View>
                  <Text selectable style={styles.recordValue}>
                    {formatValuePreview(record.value)}
                  </Text>
                  <Text style={styles.recordProvenance}>{formatProvenanceLabel(record)}</Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#132A2E',
    borderColor: '#0F766E',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  toggleCardPaused: {
    backgroundColor: '#361D24',
    borderColor: '#BE123C',
  },
  toggleTextWrap: { flex: 1 },
  toggleTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  toggleHint: { color: '#CBD5E1', fontSize: 11, lineHeight: 16, marginTop: 3 },
  toggleButton: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  toggleButtonPause: { backgroundColor: '#9F1239' },
  toggleButtonResume: { backgroundColor: '#059669' },
  toggleButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  mutedPress: { opacity: 0.55 },
  undoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 10,
  },
  undoTextWrap: { flex: 1 },
  undoTitle: { color: '#E0F2FE', fontSize: 12, fontWeight: '800' },
  undoSub: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  undoButton: {
    backgroundColor: '#0284C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  undoButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'center' },
  searchInput: {
    flex: 1,
    backgroundColor: '#1B293B',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  exportButton: {
    backgroundColor: '#334155',
    borderColor: '#475569',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  exportButtonText: { color: '#F1F5F9', fontSize: 12, fontWeight: '700' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  filterChip: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterChipActive: { backgroundColor: '#0C4A6E', borderColor: '#38BDF8' },
  filterChipText: { color: '#CBD5E1', fontSize: 11, fontWeight: '600' },
  filterChipTextActive: { color: '#E0F2FE', fontWeight: '800' },
  exportCard: {
    backgroundColor: '#172536',
    borderColor: '#D97706',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  exportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  exportTitle: { color: '#FDE68A', fontSize: 12, fontWeight: '800', flex: 1 },
  closeExportBtn: {
    backgroundColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeExportText: { color: '#E2E8F0', fontSize: 11, fontWeight: '700' },
  exportWarning: { color: '#FBBF24', fontSize: 11, lineHeight: 16, marginBottom: 8 },
  exportJson: {
    color: '#CBD5E1',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    fontSize: 11,
    lineHeight: 16,
  },
  emptyText: { color: '#94A3B8', fontSize: 12, marginTop: 14, lineHeight: 18 },
  recordCard: {
    backgroundColor: '#1B293B',
    borderColor: '#2E4057',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  recordTitleWrap: { flex: 1, paddingRight: 8 },
  recordSubject: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  recordMeta: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  recordBtns: { flexDirection: 'row', gap: 6 },
  editButton: {
    backgroundColor: '#1E3A5F',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  editBtnText: { color: '#BFDBFE', fontSize: 11, fontWeight: '800' },
  deleteButton: {
    backgroundColor: '#7F1D1D',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  deleteBtnText: { color: '#FEE2E2', fontSize: 11, fontWeight: '800' },
  recordValue: { color: '#D1FAE5', fontSize: 12, marginTop: 8, lineHeight: 18 },
  recordProvenance: { color: '#64748B', fontSize: 10, marginTop: 6 },
  editLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700', marginTop: 8 },
  editInput: {
    backgroundColor: '#0F172A',
    borderColor: '#475569',
    borderWidth: 1,
    borderRadius: 8,
    color: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
    fontSize: 13,
  },
  editInputMultiline: { minHeight: 68, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cancelEditBtn: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  cancelEditText: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
  saveEditBtn: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  saveEditText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
