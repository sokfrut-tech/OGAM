import type { ThemeColors, ThemeShadows } from '../theme';
import { SPACING } from '../constants';

export const createStyles = (colors: ThemeColors, _shadows: ThemeShadows) => ({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: SPACING.xl, paddingBottom: SPACING.xxl },
  intro: { color: colors.textSecondary, marginBottom: SPACING.md },
  card: { padding: SPACING.md, marginBottom: SPACING.md },
  fieldTitle: { color: colors.text, fontWeight: '600' as const, marginBottom: SPACING.sm },
  promptInput: {
    minHeight: 120, color: colors.text, fontSize: 15, lineHeight: 22,
    padding: SPACING.sm, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
  },
  voicePreview: { color: colors.primary, marginTop: SPACING.sm },
  actionRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: SPACING.sm, marginTop: SPACING.md },
  actionButton: {
    minHeight: 42, paddingHorizontal: SPACING.md, borderRadius: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'center' as const, gap: SPACING.xs,
  },
  recordingButton: { backgroundColor: colors.error },
  actionButtonText: { color: colors.text, fontWeight: '600' as const },
  previewStatus: { color: colors.textSecondary, marginTop: SPACING.sm, fontSize: 12 },
  negativeInput: {
    minHeight: 68, color: colors.text, fontSize: 14, padding: SPACING.sm,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
  },
  controlsTitle: { color: colors.text, fontWeight: '600' as const, marginBottom: SPACING.md },
  fieldsRow: { flexDirection: 'row' as const, gap: SPACING.md },
  field: { flex: 1 },
  fieldLabel: { color: colors.textSecondary, marginBottom: 6 },
  fieldInput: {
    color: colors.text, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: SPACING.sm,
  },
  seedField: { marginTop: SPACING.md },
  unsupportedNote: { color: colors.textMuted, fontSize: 12, marginTop: SPACING.md, lineHeight: 18 },
  statusHeader: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  progressTrack: {
    height: 6, borderRadius: 3, backgroundColor: colors.border,
    overflow: 'hidden' as const, marginTop: SPACING.md,
  },
  progressFill: { height: 6, backgroundColor: colors.primary },
  progressText: { color: colors.textMuted, fontSize: 12, marginTop: SPACING.xs },
  resultTitle: { color: colors.text, fontWeight: '600' as const, marginBottom: SPACING.sm },
  resultImage: { width: '100%' as const, borderRadius: 10 },
  resultMeta: { color: colors.textMuted, fontSize: 12, marginTop: SPACING.sm },
  error: { color: colors.error, marginBottom: SPACING.md },
  generateButton: {
    minHeight: 50, borderRadius: 12, backgroundColor: colors.primary,
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'center' as const, gap: SPACING.sm,
  },
  disabled: { opacity: 0.5 },
  generateButtonText: { color: colors.background, fontWeight: '700' as const },
});
