import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, fonts, fs, r, sp } from '../lib/theme'
import type { MuscleGroupKey, SorenessLevel } from '../lib/types'

export function RPESelector({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <View style={styles.rpeRow}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const active = value === n
        return (
          <TouchableOpacity
            key={n}
            style={[styles.rpeCircle, active && styles.rpeCircleActive]}
            onPress={() => onChange(n)}
            activeOpacity={0.8}
          >
            <Text style={[styles.rpeText, active && styles.rpeTextActive]}>{n}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const MUSCLE_ROWS: { key: MuscleGroupKey; label: string }[] = [
  { key: 'chest', label: 'Chest' },
  { key: 'back', label: 'Back' },
  { key: 'legs', label: 'Legs' },
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'arms', label: 'Arms' },
]

const SORENESS_COLORS = [colors.border, colors.accentMid, '#c98a2e', colors.error]

export function SorenessGrid({
  value,
  onChange,
}: {
  value: Record<MuscleGroupKey, SorenessLevel>
  onChange: (key: MuscleGroupKey, level: SorenessLevel) => void
}) {
  return (
    <View style={styles.sorenessWrap}>
      {MUSCLE_ROWS.map((row) => (
        <View key={row.key} style={styles.sorenessRow}>
          <Text style={styles.sorenessLabel}>{row.label}</Text>
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((level) => {
              const active = value[row.key] >= level && level > 0 ? value[row.key] === level : level === 0 && value[row.key] === 0
              const filled = level <= value[row.key] && level > 0
              return (
                <TouchableOpacity
                  key={level}
                  onPress={() => onChange(row.key, level as SorenessLevel)}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: filled ? SORENESS_COLORS[level] : 'transparent',
                      borderColor: level === 0 ? colors.borderMed : SORENESS_COLORS[level],
                    },
                  ]}
                />
              )
            })}
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  rpeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  rpeCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.borderMed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpeCircleActive: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
  rpeText: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  rpeTextActive: { color: '#fff' },
  sorenessWrap: { gap: sp.sm },
  sorenessRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  sorenessLabel: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.sm },
  dotsRow: { flexDirection: 'row', gap: 8 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
})
