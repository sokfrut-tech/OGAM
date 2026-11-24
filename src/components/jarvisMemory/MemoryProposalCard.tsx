import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatKindLabel,
  formatProvenanceLabel,
  formatScopeLabel,
  formatValuePreview,
} from '../../services/jarvisMemory/confirmationController';
import type { MemoryConflict, MemoryRecord } from '../../services/jarvisMemory/types';

export interface MemoryProposalCardProps {
  proposal: MemoryRecord;
  conflicts?: MemoryConflict[];
  busy?: boolean;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
}

/** Explicit confirmation card showing provenance, scope, conflict warning, and secret caution. */
export const MemoryProposalCard: React.FC<MemoryProposalCardProps> = ({
  proposal,
  conflicts = [],
  busy = false,
  onConfirm,
  onReject,
}) => {
  const hasDifferentConflict = conflicts.some(
    item => item.reason === 'same_subject_predicate_different_value',
  );
  const firstConflict = conflicts[0];

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <Text style={styles.kindBadge}>{formatKindLabel(proposal.kind)}</Text>
        <Text style={styles.scopeBadge}>{formatScopeLabel(proposal.scope, proposal.scopeId)}</Text>
      </View>

      <Text style={styles.subject}>{proposal.subject}</Text>
      <Text style={styles.predicate}>{proposal.predicate}</Text>
      <Text selectable style={styles.valueBox}>
        {formatValuePreview(proposal.value)}
      </Text>

      <Text style={styles.meta}>{formatProvenanceLabel(proposal)}</Text>

      {firstConflict ? (
        <View style={styles.conflictBanner}>
          <Text style={styles.conflictTitle}>
            {hasDifferentConflict
              ? 'Обнаружен конфликт с подтверждённой записью'
              : 'Повтор уже подтверждённой записи'}
          </Text>
          <Text style={styles.conflictBody}>
            Текущее значение не перезаписывается автоматически:{' '}
            {formatValuePreview(firstConflict.existingRecord.value, 140)}
          </Text>
        </View>
      ) : null}

      <Text style={styles.secretNotice}>
        Не сохраняйте пароли, токены, ключи и данные карт в долговременную память.
      </Text>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => onReject(proposal.id)}
          style={({ pressed }) => [
            styles.button,
            styles.rejectButton,
            (pressed || busy) && styles.buttonMuted,
          ]}
        >
          <Text style={styles.rejectText}>Отклонить</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => onConfirm(proposal.id)}
          style={({ pressed }) => [
            styles.button,
            styles.confirmButton,
            (pressed || busy) && styles.buttonMuted,
          ]}
        >
          <Text style={styles.confirmText}>Сохранить в память</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1B293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginTop: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  kindBadge: {
    color: '#7DD3FC',
    backgroundColor: '#0C4A6E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: '700',
  },
  scopeBadge: {
    color: '#A7F3D0',
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: '700',
  },
  subject: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  predicate: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  valueBox: {
    color: '#E2E8F0',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 8,
  },
  conflictBanner: {
    backgroundColor: '#3B2814',
    borderColor: '#D97706',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  conflictTitle: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '800',
  },
  conflictBody: {
    color: '#FDE68A',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  secretNotice: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  button: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#334155',
  },
  confirmButton: {
    backgroundColor: '#059669',
  },
  buttonMuted: {
    opacity: 0.55,
  },
  rejectText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
