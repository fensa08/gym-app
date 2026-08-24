import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { ReadinessRing } from '../../components/Ring'
import { SorenessGrid } from '../../components/Selectors'
import { getRecoveryLogs, getLatestRecoveryLog, readinessScore } from '../../lib/firestore/queriesHealth'
import {
  isHealthKitConnected,
  hasHealthKitData,
  connectHealthKit,
  syncHealthKitIfNeeded,
} from '../../lib/healthkitSync'
import type { RecoveryLog, MuscleGroupKey } from '../../lib/types'
import { errorMessage } from '../../lib/errors'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const EMPTY_SORENESS: Record<MuscleGroupKey, 0 | 1 | 2 | 3> = {
  chest: 0,
  back: 0,
  legs: 0,
  shoulders: 0,
  arms: 0,
}

export default function RecoveryHubScreen() {
  const router = useRouter()
  const [latest, setLatest] = useState<RecoveryLog | null>(null)
  const [weekLogs, setWeekLogs] = useState<RecoveryLog[]>([])
  const [hkConnected, setHkConnected] = useState(false)
  const [hkHasData, setHkHasData] = useState(true)
  const [hkConnecting, setHkConnecting] = useState(false)

  useFocusEffect(
    useCallback(() => {
      syncHealthKitIfNeeded().finally(loadData)
    }, [])
  )

  async function loadData() {
    try {
      const [l, week, connected, hadData] = await Promise.all([
        getLatestRecoveryLog(),
        getRecoveryLogs(7),
        isHealthKitConnected(),
        hasHealthKitData(),
      ])
      setLatest(l)
      setWeekLogs(week)
      setHkConnected(connected)
      setHkHasData(hadData)
    } catch (err) {
      console.error(err)
      Alert.alert('Failed to load recovery data', errorMessage(err))
    }
  }

  async function handleConnectHealthKit() {
    setHkConnecting(true)
    try {
      const result = await connectHealthKit()
      if (result === 'connected') await loadData()
    } catch (err) {
      console.error(err)
      Alert.alert('Apple Health', errorMessage(err))
    } finally {
      setHkConnecting(false)
    }
  }

  const score = readinessScore(latest)

  const factors: string[] = []
  if (latest?.sleep_hours != null) factors.push(`Sleep ${latest.sleep_hours}h`)
  if (latest?.hrv != null) factors.push(`HRV ${latest.hrv}ms`)
  if (latest?.resting_hr != null) factors.push(`RHR ${latest.resting_hr}bpm`)

  const todayStr = new Date().toISOString().slice(0, 10)
  const logsByDate = new Map(weekLogs.map((l) => [l.date, l]))
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d
  })
  const dayBars = days.map((d) => {
    const dateStr = d.toISOString().slice(0, 10)
    const log = logsByDate.get(dateStr)
    const s = readinessScore(log ?? null)
    return {
      label: DAY_LABELS[d.getDay()],
      score: s,
      isToday: dateStr === todayStr,
    }
  })
  const maxScore = 10

  const soreness: Record<MuscleGroupKey, 0 | 1 | 2 | 3> = latest
    ? {
        chest: latest.soreness_chest,
        back: latest.soreness_back,
        legs: latest.soreness_legs,
        shoulders: latest.soreness_shoulders,
        arms: latest.soreness_arms,
      }
    : EMPTY_SORENESS

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recovery</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/recovery/log')}>
          <Text style={styles.headerBtnText}>Log Check-In</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.ringCard}>
          <ReadinessRing score={score} size={200} />
          <Text style={styles.ringLabel}>Readiness Score</Text>
          <Text style={styles.factorsText}>
            {factors.length > 0 ? factors.join(' · ') : 'Log a check-in to see contributing factors'}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <StatChip
            label="Sleep"
            value={latest?.sleep_hours != null ? `${latest.sleep_hours}h` : '—'}
            synced={latest?.hk_synced?.sleep_hours}
          />
          <StatChip label="HRV" value={latest?.hrv != null ? `${latest.hrv}ms` : '—'} synced={latest?.hk_synced?.hrv} />
          <StatChip
            label="Resting HR"
            value={latest?.resting_hr != null ? `${latest.resting_hr}bpm` : '—'}
            synced={latest?.hk_synced?.resting_hr}
          />
        </View>

        {Platform.OS === 'ios' && !hkConnected && (
          <TouchableOpacity
            style={styles.hkCard}
            onPress={handleConnectHealthKit}
            activeOpacity={0.85}
            disabled={hkConnecting}
          >
            <Ionicons name="heart" size={22} color={colors.error} />
            <View style={{ flex: 1 }}>
              <Text style={styles.hkCardTitle}>Connect Apple Health</Text>
              <Text style={styles.hkCardSubtitle}>
                Auto-fill sleep, HRV, and resting heart rate from your Apple Watch
              </Text>
            </View>
            <Text style={styles.hkCardAction}>{hkConnecting ? '...' : 'Connect'}</Text>
          </TouchableOpacity>
        )}

        {Platform.OS === 'ios' && hkConnected && !hkHasData && (
          <View style={styles.hkHintCard}>
            <Text style={styles.hkHintText}>
              No Apple Health data found. Check Settings → Privacy & Security → Health → Gym Tracker.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>7-Day Readiness</Text>
          <View style={styles.bars}>
            {dayBars.map((bar, i) => {
              const pct = bar.score != null ? Math.max(0.03, bar.score / maxScore) : 0.02
              const color =
                bar.score == null
                  ? colors.border
                  : bar.score >= 7
                  ? colors.accentMid
                  : bar.score >= 5
                  ? '#c98a2e'
                  : colors.error
              return (
                <View key={i} style={styles.barCol}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: pct * 100,
                        backgroundColor: color,
                        opacity: bar.isToday ? 1 : 0.7,
                        borderWidth: bar.isToday ? 1.5 : 0,
                        borderColor: colors.textPrimary,
                      },
                    ]}
                  />
                  <Text style={[styles.barLabel, bar.isToday && styles.barLabelToday]}>{bar.label}</Text>
                </View>
              )
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Muscle Soreness</Text>
          <SorenessGrid value={soreness} onChange={() => {}} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function StatChip({ label, value, synced }: { label: string; value: string; synced?: boolean }) {
  return (
    <View style={styles.statChip}>
      {synced && (
        <View style={styles.statChipBadge}>
          <Ionicons name="heart" size={10} color={colors.error} />
        </View>
      )}
      <Text style={styles.statChipValue}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.md,
    paddingTop: sp.sm,
    paddingBottom: sp.sm,
  },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 22 },
  headerBtn: { backgroundColor: colors.accentLime, borderRadius: r.full, paddingHorizontal: 14, paddingVertical: 8 },
  headerBtnText: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.xs },
  content: { padding: sp.md, paddingTop: 0, paddingBottom: 120 },
  ringCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.lg,
    alignItems: 'center',
    marginBottom: sp.md,
  },
  ringLabel: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.md, marginTop: sp.md },
  factorsText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm, marginTop: 6, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: sp.sm, marginBottom: sp.md },
  statChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: 12,
    alignItems: 'center',
  },
  statChipBadge: { position: 'absolute', top: 8, right: 8 },
  statChipValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.lg },
  statChipLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: 4 },
  hkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
    marginBottom: sp.md,
  },
  hkCardTitle: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  hkCardSubtitle: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: 2 },
  hkCardAction: { color: colors.accentMid, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  hkHintCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
    marginBottom: sp.md,
  },
  hkHintText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, lineHeight: 16 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
    marginBottom: sp.md,
  },
  cardTitle: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: sp.md },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 100 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 6 },
  bar: { width: '100%', maxWidth: 26, minHeight: 3, borderRadius: 6 },
  barLabel: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 10 },
  barLabelToday: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold },
})
