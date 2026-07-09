import { View, Text, StyleSheet } from 'react-native'
import Svg, { Line, Path, Circle } from 'react-native-svg'
import { colors, fonts, fs } from '../lib/theme'

export interface LineSeries {
  data: { x: number; y: number }[]
  color?: string
  dashed?: boolean
  showLastDot?: boolean
}

export function LineChart({
  data,
  series,
  height = 120,
  width = 320,
  color = colors.accentMid,
  dashed = false,
}: {
  data?: { x: number; y: number }[]
  series?: LineSeries[]
  height?: number
  width?: number
  color?: string
  dashed?: boolean
}) {
  const allSeries: LineSeries[] = series ?? (data ? [{ data, color, dashed, showLastDot: true }] : [])
  const allPoints = allSeries.flatMap((s) => s.data)
  if (allPoints.length < 2) {
    return (
      <View style={{ height, width, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={styles.empty}>Not enough data yet</Text>
      </View>
    )
  }
  const ys = allPoints.map((d) => d.y)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = (maxY - minY) * 0.05 || 1
  const lo = minY - pad
  const hi = maxY + pad
  const xs = allPoints.map((d) => d.x)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const spanX = maxX - minX || 1

  const toPoint = (d: { x: number; y: number }) => {
    const px = ((d.x - minX) / spanX) * width
    const py = height - ((d.y - lo) / (hi - lo)) * height
    return [px, py]
  }

  return (
    <Svg width={width} height={height}>
      {allSeries.map((s, si) => {
        if (s.data.length < 2) return null
        const points = s.data.map(toPoint)
        const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
        const [lastX, lastY] = points[points.length - 1]
        const strokeColor = s.color ?? color
        return (
          <Path
            key={si}
            d={path}
            stroke={strokeColor}
            strokeWidth={2.5}
            fill="none"
            strokeDasharray={s.dashed ? '6 5' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )
      })}
      {allSeries.map((s, si) => {
        if (s.data.length < 2 || s.showLastDot === false) return null
        const points = s.data.map(toPoint)
        const [lastX, lastY] = points[points.length - 1]
        return <Circle key={`dot-${si}`} cx={lastX} cy={lastY} r={4} fill={s.color ?? color} />
      })}
    </Svg>
  )
}

export function BarChart({
  data,
  height = 100,
  goalLine,
  barColor = colors.accentLime,
  aboveGoalColor = '#c98a2e',
  belowGoalColor = colors.accentMid,
}: {
  data: { label: string; value: number; highlight?: boolean }[]
  height?: number
  goalLine?: number
  barColor?: string
  aboveGoalColor?: string
  belowGoalColor?: string
}) {
  const max = Math.max(...data.map((d) => d.value), goalLine ?? 0, 1)
  const goalPct = goalLine != null ? Math.min(1, goalLine / max) : null
  return (
    <View>
      <View style={[styles.barsWrap, { height }]}>
        {goalPct != null && (
          <View
            style={[
              styles.goalLine,
              { bottom: goalPct * height },
            ]}
          />
        )}
        {data.map((d, i) => {
          const pct = d.value > 0 ? Math.max(0.03, d.value / max) : 0.02
          let color = barColor
          if (goalLine != null) color = d.value > goalLine ? aboveGoalColor : belowGoalColor
          return (
            <View key={i} style={styles.barCol}>
              <View
                style={[
                  styles.bar,
                  {
                    height: pct * height,
                    backgroundColor: color,
                    opacity: d.highlight === false ? 0.4 : 1,
                  },
                ]}
              />
            </View>
          )
        })}
      </View>
      <View style={styles.labelsRow}>
        {data.map((d, i) => (
          <Text key={i} style={styles.barLabel}>{d.label}</Text>
        ))}
      </View>
    </View>
  )
}

export function DivergingBarChart({
  data,
  height = 90,
  aboveColor = colors.accentMid,
  belowColor = colors.error,
}: {
  data: { value: number }[]
  height?: number
  aboveColor?: string
  belowColor?: string
}) {
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 1)
  const half = height / 2
  return (
    <View style={[divergingStyles.wrap, { height }]}>
      {data.map((d, i) => {
        const barHeight = Math.max(2, (Math.abs(d.value) / maxAbs) * (half - 4))
        const isAbove = d.value >= 0
        return (
          <View key={i} style={divergingStyles.col}>
            <View style={[divergingStyles.half, { height: half, justifyContent: 'flex-end' }]}>
              {isAbove && <View style={[divergingStyles.bar, { height: barHeight, backgroundColor: aboveColor }]} />}
            </View>
            <View style={divergingStyles.zeroLine} />
            <View style={[divergingStyles.half, { height: half, justifyContent: 'flex-start' }]}>
              {!isAbove && <View style={[divergingStyles.bar, { height: barHeight, backgroundColor: belowColor }]} />}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const divergingStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'stretch', gap: 2 },
  col: { flex: 1, justifyContent: 'flex-start' },
  half: { alignItems: 'center' },
  bar: { width: '100%', maxWidth: 8, borderRadius: 3 },
  zeroLine: { height: 1, backgroundColor: colors.borderMed },
})

const styles = StyleSheet.create({
  empty: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm },
  barsWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    borderTopWidth: 1,
    borderColor: colors.borderMed,
    borderStyle: 'dashed',
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', maxWidth: 26, minHeight: 3, borderRadius: 6 },
  labelsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  barLabel: { flex: 1, textAlign: 'center', color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 10 },
})
