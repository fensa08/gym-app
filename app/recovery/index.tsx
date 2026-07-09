import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { ReadinessRing } from '../../components/Ring'
import { SorenessGrid } from '../../components/Selectors'
import { getRecoveryLogs, getLatestRecoveryLog, readinessScore } from '../../lib/db/queriesHealth'
import type { RecoveryLog, MuscleGroupKey } from '../../lib/types'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const EMPTY_SORENESS: Record<MuscleGroupKey, 0 | 1 | 2 | 3> = {
  chest: 0,
  back: 0,
  legs: 0,
  shoulders: 0,
  arms: 0,
}

export default function RecoveryHubScreen() {
  const db = useSQLiteContext()
  const router = useRouter()
  const [latest, setLatest] = useState<RecoveryLog | null>(null)
  const [weekLogs, setWeekLogs] = useState<RecoveryLog[]>([])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    const [l, week] = await Promise.all([getLatestRecoveryLog(db), getRecoveryLogs(db, 7)])
    setLatest(l)
    setWeekLogs(week)
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
          <StatChip label="Sleep" value={latest?.sleep_hours != null ? `${latest.sleep_hours}h` : '—'} />
          <StatChip label="HRV" value={latest?.hrv != null ? `${latest.hrv}ms` : '—'} />
          <StatChip label="Resting HR" value={latest?.resting_hr != null ? `${latest.resting_hr}bpm` : '—'} />
        </View>

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

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statChip}>
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
  statChipValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.lg },
  statChipLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: 4 },
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
