import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { isHealthKitAvailable, requestHealthKitAuthorization, fetchDailyHealthMetrics } from './healthkit'
import { mergeHealthKitMetrics } from './firestore/queriesHealth'
import { errorMessage } from './errors'

const KEY_CONNECTED = 'hk.connected'
const KEY_LAST_SYNCED_AT = 'hk.lastSyncedAt'
const KEY_LAST_SYNC_HAD_DATA = 'hk.lastSyncHadData'

const SYNC_THROTTLE_MS = 15 * 60 * 1000
const SYNC_WINDOW_MS = 72 * 3600 * 1000
const BACKFILL_MS = 30 * 24 * 3600 * 1000

export async function isHealthKitConnected(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false
  return (await AsyncStorage.getItem(KEY_CONNECTED)) === '1'
}

export async function hasHealthKitData(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY_LAST_SYNC_HAD_DATA)) !== '0'
}

/**
 * Requests HealthKit read access and backfills the last 30 days into
 * recovery_logs. Returns 'unavailable' if HealthKit isn't present on this
 * device (e.g. simulator without Health data, or non-iOS).
 */
export async function connectHealthKit(): Promise<'connected' | 'unavailable'> {
  if (!isHealthKitAvailable()) return 'unavailable'

  await requestHealthKitAuthorization()
  await AsyncStorage.setItem(KEY_CONNECTED, '1')

  const to = new Date()
  const from = new Date(to.getTime() - BACKFILL_MS)
  const metrics = await fetchDailyHealthMetrics(from, to)
  await mergeHealthKitMetrics(metrics)

  await AsyncStorage.setItem(KEY_LAST_SYNCED_AT, String(Date.now()))
  await AsyncStorage.setItem(KEY_LAST_SYNC_HAD_DATA, metrics.length > 0 ? '1' : '0')

  return 'connected'
}

/** Clears local connection state. iOS HealthKit permissions remain in Settings. */
export async function disconnectHealthKit(): Promise<void> {
  await AsyncStorage.multiRemove([KEY_CONNECTED, KEY_LAST_SYNCED_AT, KEY_LAST_SYNC_HAD_DATA])
}

/**
 * Syncs the last 72h of HealthKit data into recovery_logs if connected and
 * not synced within the throttle window. Never throws — logs and returns
 * a status instead so callers (foreground listener, screen focus) can be
 * fire-and-forget.
 */
export async function syncHealthKitIfNeeded(
  opts: { force?: boolean } = {}
): Promise<'synced' | 'skipped' | 'not-connected' | 'empty'> {
  try {
    if (!(await isHealthKitConnected())) return 'not-connected'

    if (!opts.force) {
      const lastSyncedAt = Number((await AsyncStorage.getItem(KEY_LAST_SYNCED_AT)) ?? 0)
      if (Date.now() - lastSyncedAt < SYNC_THROTTLE_MS) return 'skipped'
    }

    const to = new Date()
    const from = new Date(to.getTime() - SYNC_WINDOW_MS)
    const metrics = await fetchDailyHealthMetrics(from, to)
    await mergeHealthKitMetrics(metrics)

    await AsyncStorage.setItem(KEY_LAST_SYNCED_AT, String(Date.now()))
    await AsyncStorage.setItem(KEY_LAST_SYNC_HAD_DATA, metrics.length > 0 ? '1' : '0')

    return metrics.length > 0 ? 'synced' : 'empty'
  } catch (err) {
    console.warn('[healthkitSync] sync failed:', errorMessage(err))
    return 'skipped'
  }
}
