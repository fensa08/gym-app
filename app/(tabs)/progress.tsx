import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { colors, sp, r, fs } from '../../lib/theme'
import { getRecentWorkouts, getWeeklyVolume, getAllPRs } from '../../lib/db/queries'
import type { Workout } from '../../lib/types'

const BAR_MAX_H = 100

export default function ProgressScreen() {
  const db = useSQLiteContext()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [volumeData, setVolumeData] = useState<{ day: string; volume: number }[]>([])
  const [prs, setPrs] = useState<{ exercise_name: string; weight_kg: number; reps: number }[]>([])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    const [ws, vd, records] = await Promise.all([
      getRecentWorkouts(db, 20),
      getWeeklyVolume(db),
      getAllPRs(db),
    ])
    setWorkouts(ws)
    setVolumeData(vd)
    setPrs(records)
  }

  const maxVol = Math.max(...volumeData.map((d) => d.volume), 1)
  const totalVol = volumeData.reduce((s, d) => s + d.volume, 0)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Progress</Text>

        {/* Summary chips */}
        <View style={styles.summaryRow}>
          <SummaryCard value={String(workouts.length)} label="Workouts" color={colors.accent} />
          <SummaryCard value={fmtVol(totalVol)} label="Volume kg" color={colors.success} />
          <SummaryCard value={String(prs.length)} label="Records" color="#FFB800" />
        </View>

        {/* Volume chart */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>VOLUME · LAST 7 DAYS</Text>
          <View style={styles.chartCard}>
            {volumeData.length === 0 ? (
              <View style={styles.emptyChart}>
                <Ionicons name="bar-chart-outline" size={40} color={colors.border} />
                <Text style={styles.emptyText}>Log workouts to see volume</Text>
              </View>
            ) : (
              <View style={styles.bars}>
                {volumeData.map((d, i) => {
                  const h = Math.max(4, (d.volume / maxVol) * BAR_MAX_H)
                  return (
                    <View key={i} style={styles.barCol}>
                      <Text style={styles.barVal}>{fmtVol(d.volume)}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: h }]} />
                      </View>
                      <Text style={styles.barDay}>
                        {format(new Date(d.day), 'EEE')}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        </View>

        {/* PRs */}
        {prs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PERSONAL RECORDS</Text>
            {prs.map((pr, i) => (
              <View key={i} style={styles.prRow}>
                <Text style={styles.trophy}>🏆</Text>
                <Text style={styles.prName}>{pr.exercise_name}</Text>
                <Text style={styles.prVal}>
                  {pr.weight_kg} kg × {pr.reps}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Workout history */}
        <View style={[styles.section, { marginBottom: 32 }]}>
          <Text style={styles.sectionLabel}>WORKOUT HISTORY</Text>
          {workouts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="fitness-outline" size={40} color={colors.border} />
              <Text style={styles.emptyText}>No workouts yet — start your first session!</Text>
            </View>
          ) : (
            workouts.map((w) => (
              <View key={w.id} style={styles.historyRow}>
                <View style={styles.historyDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName}>{w.name}</Text>
                  <Text style={styles.historyDate}>
                    {format(new Date(w.started_at), 'EEE, MMM d · h:mm a')}
                  </Text>
                </View>
                {w.finished_at && (
                  <Text style={styles.historyDur}>
                    {Math.round((w.finished_at - w.started_at) / 60000)}m
                  </Text>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function SummaryCard({
  value,
  label,
  color,
}: {
  value: string
  label: string
  color: string
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  )
}

function fmtVol(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return String(Math.round(v))
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: sp.md, paddingBottom: 100 },
  title: {
    color: colors.textPrimary,
    fontSize: fs.xl,
    fontWeight: '800',
    marginBottom: sp.lg,
    marginTop: sp.sm,
  },
  summaryRow: { flexDirection: 'row', gap: sp.sm, marginBottom: sp.lg },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: r.lg,
    padding: sp.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryValue: { fontSize: fs.xxl, fontWeight: '800' },
  summaryLabel: { color: colors.textSecondary, fontSize: fs.xs, marginTop: 2 },
  section: { marginBottom: sp.xl },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: fs.xs,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: sp.md,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: r.lg,
    padding: sp.md,
    borderWidth: 1,
    borderColor: colors.border,
    height: 180,
    justifyContent: 'center',
  },
  emptyChart: { alignItems: 'center', gap: sp.sm },
  bars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: sp.sm,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barVal: { color: colors.textSecondary, fontSize: 9, fontWeight: '600' },
  barTrack: {
    width: '100%',
    height: BAR_MAX_H,
    justifyContent: 'flex-end',
  },
  barFill: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    width: '100%',
    minHeight: 4,
  },
  barDay: { color: colors.textSecondary, fontSize: fs.xs },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    backgroundColor: colors.surface,
    borderRadius: r.md,
    padding: sp.md,
    marginBottom: sp.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trophy: { fontSize: 18 },
  prName: { flex: 1, color: colors.textPrimary, fontSize: fs.md, fontWeight: '600' },
  prVal: { color: colors.accentWarm, fontSize: fs.sm, fontWeight: '700' },
  emptyState: { alignItems: 'center', gap: sp.md, paddingVertical: sp.xl },
  emptyText: { color: colors.textSecondary, fontSize: fs.sm, textAlign: 'center' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    paddingVertical: sp.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  historyName: { color: colors.textPrimary, fontSize: fs.md, fontWeight: '600' },
  historyDate: { color: colors.textSecondary, fontSize: fs.xs, marginTop: 2 },
  historyDur: { color: colors.textSecondary, fontSize: fs.sm },
})
