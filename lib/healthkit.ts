import { Platform } from 'react-native'

export interface DailyHealthMetrics {
  date: string // YYYY-MM-DD, matches the doc-key format used by queriesHealth.today()
  sleep_hours?: number
  hrv?: number // SDNN daily average, ms
  resting_hr?: number // bpm, latest sample of the day
}

export const HK_READ_TYPES = [
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRestingHeartRate',
] as const

// Nitro modules crash on import outside iOS, so the lib is required lazily.
function hk() {
  return require('@kingstinct/react-native-healthkit') as typeof import('@kingstinct/react-native-healthkit')
}

export function isHealthKitAvailable(): boolean {
  if (Platform.OS !== 'ios') return false
  try {
    return hk().isHealthDataAvailable()
  } catch {
    return false
  }
}

export async function requestHealthKitAuthorization(): Promise<boolean> {
  return hk().requestAuthorization({ toRead: HK_READ_TYPES })
}

// Key by local calendar day, formatted like today() (anchor at local noon so
// the UTC conversion in toISOString can't flip the date).
function dayKey(d: Date): string {
  const noon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12)
  return noon.toISOString().slice(0, 10)
}

interface SampleLike {
  startDate: Date
  endDate: Date
  sourceRevision?: { source?: { bundleIdentifier?: string }; productType?: string }
}

const isWatchSource = (s: SampleLike) => s.sourceRevision?.productType?.startsWith('Watch') ?? false

// Sleep category values that count as actually asleep (excludes inBed=0, awake=2).
const ASLEEP_VALUES = new Set([1, 3, 4, 5])

/**
 * Sums a night's asleep time and attributes it to the wake date: the night
 * window for day D is 18:00 of D-1 → 18:00 of D, bucketed by sample end time.
 * iPhone and Watch both record overlapping sleep sessions, so per night only
 * the single source with the most asleep time is kept (avoids interval math).
 */
export function aggregateSleep(
  samples: (SampleLike & { value: number })[]
): Map<string, number> {
  const perNight = new Map<string, Map<string, number>>() // dayKey -> sourceId -> seconds
  for (const s of samples) {
    if (!ASLEEP_VALUES.has(s.value)) continue
    const end = new Date(s.endDate)
    const wakeDay = new Date(end)
    if (end.getHours() >= 18) wakeDay.setDate(wakeDay.getDate() + 1)
    const key = dayKey(wakeDay)
    const source = s.sourceRevision?.source?.bundleIdentifier ?? 'unknown'
    const bySource = perNight.get(key) ?? new Map<string, number>()
    const secs = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 1000
    bySource.set(source, (bySource.get(source) ?? 0) + secs)
    perNight.set(key, bySource)
  }
  const result = new Map<string, number>()
  for (const [key, bySource] of perNight) {
    const best = Math.max(...bySource.values())
    if (best > 0) result.set(key, Math.round((best / 3600) * 10) / 10)
  }
  return result
}

/** Daily mean SDNN; prefers Apple Watch samples when a day has any. */
export function aggregateHrv(samples: (SampleLike & { quantity: number })[]): Map<string, number> {
  const byDay = new Map<string, (SampleLike & { quantity: number })[]>()
  for (const s of samples) {
    const key = dayKey(new Date(s.startDate))
    byDay.set(key, [...(byDay.get(key) ?? []), s])
  }
  const result = new Map<string, number>()
  for (const [key, daySamples] of byDay) {
    const watch = daySamples.filter(isWatchSource)
    const used = watch.length > 0 ? watch : daySamples
    const mean = used.reduce((sum, s) => sum + s.quantity, 0) / used.length
    result.set(key, Math.round(mean))
  }
  return result
}

/** HealthKit emits ~one resting HR value per day; keeps the latest per day. */
export function aggregateRestingHr(
  samples: (SampleLike & { quantity: number })[]
): Map<string, number> {
  const result = new Map<string, { at: number; bpm: number }>()
  for (const s of samples) {
    const key = dayKey(new Date(s.startDate))
    const at = new Date(s.startDate).getTime()
    const prev = result.get(key)
    if (!prev || at > prev.at) result.set(key, { at, bpm: Math.round(s.quantity) })
  }
  return new Map([...result].map(([key, v]) => [key, v.bpm]))
}

/**
 * Reads sleep/HRV/resting-HR from HealthKit and aggregates per local day.
 * Days without any data are omitted. Throws on native query errors.
 */
export async function fetchDailyHealthMetrics(from: Date, to: Date): Promise<DailyHealthMetrics[]> {
  const { queryCategorySamples, queryQuantitySamples } = hk()
  // Sleep for wake-date `from` can start the previous evening.
  const sleepFrom = new Date(from.getTime() - 24 * 3600 * 1000)
  const [sleepSamples, hrvSamples, rhrSamples] = await Promise.all([
    queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      filter: { date: { startDate: sleepFrom, endDate: to } },
      ascending: true,
      limit: 0,
    }),
    queryQuantitySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', {
      filter: { date: { startDate: from, endDate: to } },
      unit: 'ms',
      ascending: true,
      limit: 0,
    }),
    queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', {
      filter: { date: { startDate: from, endDate: to } },
      unit: 'count/min',
      ascending: true,
      limit: 0,
    }),
  ])

  const sleep = aggregateSleep(sleepSamples as any)
  const hrv = aggregateHrv(hrvSamples as any)
  const restingHr = aggregateRestingHr(rhrSamples as any)

  const fromKey = dayKey(from)
  const toKey = dayKey(to)
  const days = new Set([...sleep.keys(), ...hrv.keys(), ...restingHr.keys()])
  const metrics: DailyHealthMetrics[] = []
  for (const date of [...days].sort()) {
    if (date < fromKey || date > toKey) continue
    metrics.push({
      date,
      ...(sleep.has(date) ? { sleep_hours: sleep.get(date) } : {}),
      ...(hrv.has(date) ? { hrv: hrv.get(date) } : {}),
      ...(restingHr.has(date) ? { resting_hr: restingHr.get(date) } : {}),
    })
  }
  return metrics
}
