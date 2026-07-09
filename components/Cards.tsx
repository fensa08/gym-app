import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, fs, r, sp } from '../lib/theme'

export function StatChip({
  icon,
  label,
  value,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name']
  label: string
  value: string
}) {
  return (
    <View style={styles.chip}>
      {icon && <Ionicons name={icon} size={13} color={colors.textSecondary} style={{ marginBottom: 4 }} />}
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  )
}

export function SignalCard({
  title,
  headline,
  accentColor,
  children,
  recommendation,
}: {
  title: string
  headline: string
  accentColor: string
  children?: React.ReactNode
  recommendation?: string
}) {
  return (
    <View style={styles.signalCard}>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={styles.signalContent}>
        <Text style={styles.signalTitle}>{title}</Text>
        <Text style={styles.signalHeadline}>{headline}</Text>
        {children}
        {recommendation && (
          <View style={styles.recBlock}>
            <Text style={styles.recLabel}>What to do</Text>
            <Text style={styles.recText}>{recommendation}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    backgroundColor: colors.surfaceInput,
    borderRadius: r.md,
    padding: 10,
    alignItems: 'center',
  },
  chipValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.md },
  chipLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 10, marginTop: 2, textAlign: 'center' },
  signalCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    marginBottom: sp.md,
    overflow: 'hidden',
  },
  accentBar: { width: 4 },
  signalContent: { flex: 1, padding: sp.md, gap: 8 },
  signalTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  signalHeadline: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: fs.lg },
  recBlock: { backgroundColor: colors.surfaceInput, borderRadius: r.md, padding: sp.sm, marginTop: 4 },
  recLabel: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: 10, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  recText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.sm, lineHeight: 18 },
})
