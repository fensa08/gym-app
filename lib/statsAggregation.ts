// Pure, unit-testable aggregation math for the Stats screen. No Firestore
// or UI imports here — callers in lib/firestore/*.ts and app/(tabs)/stats.tsx
// fetch raw rows and pass them in.

export interface DatedValue {
  date: string // ISO yyyy-mm-dd
  value: number
}

/** Epley formula: estimated 1-rep max from a completed set. */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 0) return weightKg
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

/**
 * Trailing rolling average over `window` days, keyed by calendar date rather
 * than array index — a gap in `series` (no entry logged that day) does not
 * shift later windows, it's simply excluded from the average.
 */
export function rollingAverageByDate(series: DatedValue[], windowDays: number): DatedValue[] {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date))
  const dayMs = 86400000
  return sorted.map((point) => {
    const cutoff = new Date(point.date).getTime() - (windowDays - 1) * dayMs
    const inWindow = sorted.filter((p) => {
      const t = new Date(p.date).getTime()
      return t <= new Date(point.date).getTime() && t >= cutoff
    })
    const avg = inWindow.reduce((s, p) => s + p.value, 0) / inWindow.length
    return { date: point.date, value: avg }
  })
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((s, v) => s + v, 0) / values.length
}

/** ISO week key (Monday start), e.g. "2026-W07". */
export function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  // Shift to the Thursday of this week so the ISO week number is unambiguous.
  const dayNum = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dayNum + 3)
  const firstThursday = new Date(d.getFullYear(), 0, 4)
  const firstDayNum = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstDayNum + 3)
  const weekNum = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000))
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

export interface WeeklyAverage {
  weekKey: string
  /** ISO date of the Monday that starts this week, for chart x-axis positioning. */
  weekStart: string
  average: number
}

/** Groups dated values by ISO week and averages within each week. */
export function weeklyAverages(series: DatedValue[]): WeeklyAverage[] {
  const byWeek = new Map<string, { sum: number; count: number; minDate: string }>()
  for (const point of series) {
    const key = isoWeekKey(point.date)
    const existing = byWeek.get(key)
    if (existing) {
      existing.sum += point.value
      existing.count += 1
      if (point.date < existing.minDate) existing.minDate = point.date
    } else {
      byWeek.set(key, { sum: point.value, count: 1, minDate: point.date })
    }
  }
  return Array.from(byWeek.entries())
    .map(([weekKey, { sum, count, minDate }]) => ({
      weekKey,
      weekStart: isoWeekStart(minDate),
      average: sum / count,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
}

export interface ProteinPerKgPoint {
  date: string
  gramsPerKg: number
}

/**
 * Joins daily protein intake against bodyweight, using the most recent
 * bodyweight logged on or before each nutrition date (bodyweight isn't
 * necessarily logged every day, nutrition might be).
 */
export function proteinPerKgSeries(
  nutritionLogs: { date: string; protein_g: number | null }[],
  weightLogs: { date: string; weight_kg: number }[]
): ProteinPerKgPoint[] {
  const sortedWeights = [...weightLogs].sort((a, b) => a.date.localeCompare(b.date))
  const nearestWeightOnOrBefore = (date: string): number | null => {
    let best: number | null = null
    for (const w of sortedWeights) {
      if (w.date <= date) best = w.weight_kg
      else break
    }
    return best
  }
  return nutritionLogs
    .filter((l): l is { date: string; protein_g: number } => l.protein_g != null)
    .map((l) => {
      const weight = nearestWeightOnOrBefore(l.date)
      if (weight == null || weight <= 0) return null
      return { date: l.date, gramsPerKg: l.protein_g / weight }
    })
    .filter((p): p is ProteinPerKgPoint => p != null)
}

/** Returns the dates where a nightly value falls below `thresholdHours`. */
export function nightsBelowThreshold(
  series: { date: string; hours: number }[],
  thresholdHours = 7
): string[] {
  return series.filter((s) => s.hours < thresholdHours).map((s) => s.date)
}

/** Default weekly training-frequency target per muscle group (sessions/week). */
export const TARGET_FREQUENCY_PER_MUSCLE_GROUP: Record<string, number> = {
  Chest: 2,
  Back: 2,
  Legs: 2,
  Shoulders: 2,
  Biceps: 2,
  Triceps: 2,
  Core: 2,
}

/** ISO date of the Monday that starts the week containing `dateStr`. */
export function isoWeekStart(dateStr: string): string {
  const d = new Date(dateStr)
  const dayNum = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dayNum)
  return d.toISOString().slice(0, 10)
}

export type Trend = 'up' | 'down' | 'flat'

/**
 * Classifies a trailing sequence of values as up/down/flat, ignoring moves
 * smaller than `flatThresholdPct` of the starting value (default 1%) — pure
 * noise shouldn't read as a trend.
 */
export function classifyTrend(values: number[], flatThresholdPct = 0.01): Trend {
  if (values.length < 2) return 'flat'
  const first = values[0]
  const last = values[values.length - 1]
  if (first === 0) return last === 0 ? 'flat' : last > 0 ? 'up' : 'down'
  const pctChange = (last - first) / Math.abs(first)
  if (Math.abs(pctChange) < flatThresholdPct) return 'flat'
  return pctChange > 0 ? 'up' : 'down'
}

/** Filters a dated series to the last N days relative to `now` (default: today). */
export function lastNDays<T extends { date: string }>(series: T[], days: number, now = new Date()): T[] {
  const since = new Date(now)
  since.setDate(since.getDate() - (days - 1))
  const sinceStr = since.toISOString().slice(0, 10)
  return series.filter((p) => p.date >= sinceStr)
}

/** Chart granularity — how many raw days get averaged into one plotted point. */
export type Granularity = 'day' | 'week' | 'month' | 'quarter' | 'half-year' | 'year'

/** Period options for a granularity selector, each paired with a sensible lookback window in days. */
export const GRANULARITY_OPTIONS: { key: Granularity; label: string; days: number }[] = [
  { key: 'day', label: 'Day', days: 30 },
  { key: 'week', label: 'Week', days: 90 },
  { key: 'month', label: 'Month', days: 365 },
  { key: 'quarter', label: '3 Months', days: 730 },
  { key: 'half-year', label: '6 Months', days: 1095 },
  { key: 'year', label: '12 Months', days: 1825 },
]

/** ISO date of the first day of the bucket `dateStr` falls into for `granularity`. */
function periodStartFor(dateStr: string, granularity: Granularity): string {
  if (granularity === 'day') return dateStr
  if (granularity === 'week') return isoWeekStart(dateStr)
  const d = new Date(dateStr)
  const year = d.getFullYear()
  const pad = (n: number) => String(n).padStart(2, '0')
  if (granularity === 'month') return `${year}-${pad(d.getMonth() + 1)}-01`
  if (granularity === 'quarter') return `${year}-${pad(Math.floor(d.getMonth() / 3) * 3 + 1)}-01`
  if (granularity === 'half-year') return `${year}-${pad(d.getMonth() < 6 ? 1 : 7)}-01`
  return `${year}-01-01`
}

/** Groups a dated series into buckets of `granularity`, averaging values within each bucket. */
export function groupByPeriod(series: DatedValue[], granularity: Granularity): DatedValue[] {
  if (granularity === 'day') {
    return [...series].sort((a, b) => a.date.localeCompare(b.date))
  }
  const byPeriod = new Map<string, { sum: number; count: number }>()
  for (const point of series) {
    const key = periodStartFor(point.date, granularity)
    const existing = byPeriod.get(key)
    if (existing) {
      existing.sum += point.value
      existing.count += 1
    } else {
      byPeriod.set(key, { sum: point.value, count: 1 })
    }
  }
  return Array.from(byPeriod.entries())
    .map(([date, { sum, count }]) => ({ date, value: sum / count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Trailing rolling average over the last `window` *points* (not calendar days) — for use on already-bucketed series. */
export function rollingAverageIndexed(series: DatedValue[], window: number): DatedValue[] {
  return series.map((point, i) => {
    const slice = series.slice(Math.max(0, i - window + 1), i + 1)
    const avg = slice.reduce((s, p) => s + p.value, 0) / slice.length
    return { date: point.date, value: avg }
  })
}
