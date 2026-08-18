import { View, Text, StyleSheet } from 'react-native'
import Svg, { Line, Path, Circle } from 'react-native-svg'
import { colors, fonts, fs } from '../lib/theme'

export interface LineSeries {
  data: { x: number; y: number }[]
  color?: string
  dashed?: boolean
  showLastDot?: boolean
}

export interface AxisConfig {
  ticks: number[]
  format?: (v: number) => string
}

const defaultFmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

/** "Nice" evenly-spaced tick values (steps of 1/2/5/10^n) spanning [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!isFinite(min) || !isFinite(max)) return []
  if (min === max) return [min]
  const span = max - min
  const rawStep = span / Math.max(1, count - 1)
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm = rawStep / mag
  const niceNorm = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10
  const step = niceNorm * mag
  const niceMin = Math.floor(min / step) * step
  const niceMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = niceMin; v <= niceMax + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}

/** Evenly-spaced ticks at a fixed step (e.g. one per whole kg) spanning [min, max]. */
export function integerTicks(min: number, max: number, step = 1): number[] {
  if (!isFinite(min) || !isFinite(max)) return []
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}

/** Evenly picks up to maxCount items from an array (always includes first & last). */
export function sampleTicks<T>(items: T[], maxCount = 5): T[] {
  if (items.length <= maxCount) return items
  const step = (items.length - 1) / (maxCount - 1)
  const out: T[] = []
  for (let i = 0; i < maxCount; i++) out.push(items[Math.round(i * step)])
  return out
}

export function LineChart({
  data,
  series,
  height = 120,
  width = 320,
  color = colors.accentMid,
  dashed = false,
  band,
  yAxis,
  xAxis,
}: {
  data?: { x: number; y: number }[]
  series?: LineSeries[]
  height?: number
  width?: number
  color?: string
  dashed?: boolean
  /** Shaded target range (e.g. protein g/kg 1.6-2.2) drawn as two dashed horizontal lines. */
  band?: { min: number; max: number; color?: string }
  /** Y-axis tick labels + gridlines (e.g. one per kg). */
  yAxis?: AxisConfig
  /** X-axis tick labels below the chart (values are the same units as point.x, e.g. timestamps). */
  xAxis?: AxisConfig
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
  let minY = Math.min(...ys)
  let maxY = Math.max(...ys)
  if (band) {
    minY = Math.min(minY, band.min)
    maxY = Math.max(maxY, band.max)
  }
  const hasYAxis = !!yAxis && yAxis.ticks.length > 0
  if (hasYAxis) {
    minY = Math.min(minY, yAxis!.ticks[0])
    maxY = Math.max(maxY, yAxis!.ticks[yAxis!.ticks.length - 1])
  }
  const pad = hasYAxis ? 0 : (maxY - minY) * 0.05 || 1
  const lo = minY - pad
  const hi = maxY + pad
  const xs = allPoints.map((d) => d.x)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const spanX = maxX - minX || 1

  const axisGutter = hasYAxis ? 36 : 0
  const chartWidth = width - axisGutter
  const yFmt = yAxis?.format ?? defaultFmt
  const xFmt = xAxis?.format ?? defaultFmt

  const toPoint = (d: { x: number; y: number }) => {
    const px = ((d.x - minX) / spanX) * chartWidth
    const py = height - ((d.y - lo) / (hi - lo)) * height
    return [px, py]
  }
  const toY = (y: number) => height - ((y - lo) / (hi - lo)) * height
  const toX = (x: number) => ((x - minX) / spanX) * chartWidth

  const chart = (
    <View>
      <Svg width={chartWidth} height={height}>
        {hasYAxis &&
          yAxis!.ticks.map((t) => (
            <Line
              key={`grid-${t}`}
              x1={0}
              x2={chartWidth}
              y1={toY(t)}
              y2={toY(t)}
              stroke={colors.borderMed}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}
        {band && (
          <>
            <Line
              x1={0}
              x2={chartWidth}
              y1={toY(band.max)}
              y2={toY(band.max)}
              stroke={band.color ?? colors.borderMed}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <Line
              x1={0}
              x2={chartWidth}
              y1={toY(band.min)}
              y2={toY(band.min)}
              stroke={band.color ?? colors.borderMed}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          </>
        )}
        {allSeries.map((s, si) => {
          if (s.data.length < 2) return null
          const points = s.data.map(toPoint)
          const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
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
      {xAxis && xAxis.ticks.length > 0 && (
        <View style={{ height: 16, width: chartWidth }}>
          {xAxis.ticks.map((t) => (
            <Text
              key={`xt-${t}`}
              style={[styles.axisLabelX, { position: 'absolute', left: toX(t), transform: [{ translateX: -16 }] }]}
            >
              {xFmt(t)}
            </Text>
          ))}
        </View>
      )}
    </View>
  )

  if (!hasYAxis) return chart

  const ticksDesc = [...yAxis!.ticks].reverse()
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: axisGutter, height, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6 }}>
        {ticksDesc.map((t) => (
          <Text key={t} style={styles.axisLabel}>{yFmt(t)}</Text>
        ))}
      </View>
      {chart}
    </View>
  )
}

export function BarChart({
  data,
  height = 100,
  goalLine,
  barColor = colors.accentLime,
  aboveGoalColor = '#c98a2e',
  belowGoalColor = colors.accentMid,
  yAxis,
}: {
  data: { label: string; value: number; highlight?: boolean }[]
  height?: number
  goalLine?: number
  barColor?: string
  aboveGoalColor?: string
  belowGoalColor?: string
  /** Y-axis tick labels + gridlines (e.g. calorie amounts). */
  yAxis?: AxisConfig
}) {
  const hasAxis = !!yAxis && yAxis.ticks.length > 0
  const lo = hasAxis ? yAxis!.ticks[0] : 0
  const hi = hasAxis ? yAxis!.ticks[yAxis!.ticks.length - 1] : Math.max(...data.map((d) => d.value), goalLine ?? 0, 1)
  const span = hi - lo || 1
  const valuePct = (v: number) => Math.max(0, Math.min(1, (v - lo) / span))
  const goalPct = goalLine != null ? valuePct(goalLine) : null
  const yFmt = yAxis?.format ?? defaultFmt

  const chart = (
    <View>
      <View style={[styles.barsWrap, { height }]}>
        {hasAxis &&
          yAxis!.ticks.map((t) => (
            <View key={`grid-${t}`} style={[styles.gridLine, { bottom: valuePct(t) * height }]} />
          ))}
        {goalPct != null && (
          <View
            style={[
              styles.goalLine,
              { bottom: goalPct * height },
            ]}
          />
        )}
        {data.map((d, i) => {
          const pct = d.value > 0 ? Math.max(hasAxis ? 0.01 : 0.03, valuePct(d.value)) : 0.02
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

  if (!hasAxis) return chart

  const ticksDesc = [...yAxis!.ticks].reverse()
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: 36, height, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6 }}>
        {ticksDesc.map((t) => (
          <Text key={t} style={styles.axisLabel}>{yFmt(t)}</Text>
        ))}
      </View>
      <View style={{ flex: 1 }}>{chart}</View>
    </View>
  )
}

/**
 * Daily bars (e.g. nightly sleep, daily calories) with a rolling-average
 * line overlaid on top. Bars and line share the same category positions
 * (one per data point), so `lineValue` should already be the caller's
 * rolling average aligned to the same dates as `value`.
 */
export function BarWithLineChart({
  data,
  height = 100,
  width = 320,
  barColor = colors.accentLime,
  belowColor = colors.error,
  lineColor = colors.accentMid,
  yAxis,
}: {
  data: { value: number; lineValue: number | null; below?: boolean }[]
  height?: number
  width?: number
  barColor?: string
  belowColor?: string
  lineColor?: string
  /** Y-axis tick labels + gridlines (e.g. calorie amounts). */
  yAxis?: AxisConfig
}) {
  const hasAxis = !!yAxis && yAxis.ticks.length > 0
  const allValues = data.flatMap((d) => [d.value, d.lineValue ?? d.value])
  const lo = hasAxis ? yAxis!.ticks[0] : 0
  const hi = hasAxis ? yAxis!.ticks[yAxis!.ticks.length - 1] : Math.max(...allValues, 1)
  const span = hi - lo || 1
  const valuePct = (v: number) => Math.max(0, Math.min(1, (v - lo) / span))
  const yFmt = yAxis?.format ?? defaultFmt
  const axisGutter = hasAxis ? 36 : 0
  const chartWidth = width - axisGutter
  const n = data.length
  // Matches styles.barsWrap's `gap: 8` flex layout so the line lands on bar centers.
  const colGap = 8
  const colWidth = (chartWidth - colGap * (n - 1)) / n

  const linePoints = data
    .map((d, i) => (d.lineValue == null ? null : [
      i * (colWidth + colGap) + colWidth / 2,
      height - valuePct(d.lineValue) * height,
    ]))
    .filter((p): p is [number, number] => p != null)
  const linePath = linePoints.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

  const chart = (
    <View style={{ height, width: chartWidth }}>
      <View style={[styles.barsWrap, { height, position: 'absolute', left: 0, right: 0 }]}>
        {hasAxis &&
          yAxis!.ticks.map((t) => (
            <View key={`grid-${t}`} style={[styles.gridLine, { bottom: valuePct(t) * height }]} />
          ))}
        {data.map((d, i) => {
          const pct = d.value > 0 ? Math.max(hasAxis ? 0.01 : 0.03, valuePct(d.value)) : 0.02
          return (
            <View key={i} style={styles.barCol}>
              <View
                style={[
                  styles.bar,
                  { height: pct * height, backgroundColor: d.below ? belowColor : barColor },
                ]}
              />
            </View>
          )
        })}
      </View>
      {linePoints.length >= 2 && (
        <Svg width={chartWidth} height={height}>
          <Path d={linePath} stroke={lineColor} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </Svg>
      )}
    </View>
  )

  if (!hasAxis) return chart

  const ticksDesc = [...yAxis!.ticks].reverse()
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: axisGutter, height, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6 }}>
        {ticksDesc.map((t) => (
          <Text key={t} style={styles.axisLabel}>{yFmt(t)}</Text>
        ))}
      </View>
      {chart}
    </View>
  )
}

export function DivergingBarChart({
  data,
  height = 90,
  aboveColor = colors.accentMid,
  belowColor = colors.error,
  yAxis,
}: {
  data: { value: number }[]
  height?: number
  aboveColor?: string
  belowColor?: string
  /** Symmetric Y-axis; only the largest tick magnitude is used (labeled as +/-N and 0). */
  yAxis?: AxisConfig
}) {
  const hasAxis = !!yAxis && yAxis.ticks.length > 0
  const axisMax = hasAxis ? Math.max(...yAxis!.ticks.map((t) => Math.abs(t))) : 0
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), axisMax, 1)
  const half = height / 2
  const yFmt = yAxis?.format ?? defaultFmt

  const chart = (
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

  if (!hasAxis) return chart

  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: 36, height, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6 }}>
        <Text style={styles.axisLabel}>+{yFmt(axisMax)}</Text>
        <Text style={styles.axisLabel}>0</Text>
        <Text style={styles.axisLabel}>-{yFmt(axisMax)}</Text>
      </View>
      <View style={{ flex: 1 }}>{chart}</View>
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
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.borderMed,
    opacity: 0.5,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', maxWidth: 26, minHeight: 3, borderRadius: 6 },
  labelsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  barLabel: { flex: 1, textAlign: 'center', color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 10 },
  axisLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 9 },
  axisLabelX: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 9, textAlign: 'center', width: 32 },
})
