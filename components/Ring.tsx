import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { colors, fonts, fs } from '../lib/theme'

export function ReadinessRing({ score, size = 148 }: { score: number | null; size?: number }) {
  const r = size / 2 - 12
  const circ = 2 * Math.PI * r
  const pct = score == null ? 0 : Math.max(0, Math.min(1, score / 10))
  const color = score == null ? colors.textSecondary : score >= 7 ? colors.accentMid : score >= 5 ? '#c98a2e' : colors.error
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.border} strokeWidth={12} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${pct * circ} ${circ}`}
        />
      </Svg>
      <Text style={[ringStyles.score, { fontSize: size * 0.32 }]}>{score == null ? '—' : score.toFixed(1)}</Text>
    </View>
  )
}

export function ProgressRing({
  value,
  goal,
  size = 84,
  color = colors.accentMid,
  label,
}: {
  value: number
  goal: number
  size?: number
  color?: string
  label?: string
}) {
  const r = size / 2 - 8
  const circ = 2 * Math.PI * r
  const pct = goal > 0 ? Math.max(0, Math.min(1, value / goal)) : 0
  return (
    <View style={{ width: size, alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.border} strokeWidth={8} />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={`${pct * circ} ${circ}`}
          />
        </Svg>
        <Text style={[ringStyles.pctLabel, { fontSize: size * 0.2 }]}>{Math.round(pct * 100)}%</Text>
      </View>
      {label && <Text style={ringStyles.label}>{label}</Text>}
    </View>
  )
}

const ringStyles = StyleSheet.create({
  score: { position: 'absolute', color: colors.textPrimary, fontFamily: fonts.monoBold },
  pctLabel: { position: 'absolute', color: colors.textPrimary, fontFamily: fonts.monoSemiBold },
  label: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: fs.xs, marginTop: 6 },
})
