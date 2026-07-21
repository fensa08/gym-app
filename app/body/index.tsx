import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { format } from 'date-fns'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { LineChart } from '../../components/Charts'
import {
  getBodyWeightLogs,
  getBodyCompositionHistory,
  getLatestBodyComposition,
  getPreviousBodyComposition,
  getUserGoals,
} from '../../lib/firestore/queriesHealth'
import { computeFFMI } from '../../lib/insights'
import type { BodyWeightLog, BodyCompositionLog, UserGoals } from '../../lib/types'

export const CIRCUMFERENCE_FIELDS: { key: keyof BodyCompositionLog; label: string }[] = [
  { key: 'chest_cm', label: 'Chest' },
  { key: 'waist_cm', label: 'Waist' },
  { key: 'hips_cm', label: 'Hips' },
  { key: 'arms_cm', label: 'Arms' },
  { key: 'thighs_cm', label: 'Thighs' },
  { key: 'calves_cm', label: 'Calves' },
]

export default function BodyHubScreen() {
  const router = useRouter()
  const [weights, setWeights] = useState<BodyWeightLog[]>([])
  const [comps, setComps] = useState<BodyCompositionLog[]>([])
  const [latestComp, setLatestComp] = useState<BodyCompositionLog | null>(null)
  const [prevComp, setPrevComp] = useState<BodyCompositionLog | null>(null)
  const [goals, setGoals] = useState<UserGoals | null>(null)

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    const [w, c, latest, prev, g] = await Promise.all([
      getBodyWeightLogs(30),
      getBodyCompositionHistory(60),
      getLatestBodyComposition(),
      getPreviousBodyComposition(),
      getUserGoals(),
    ])
    setWeights(w)
    setComps(c)
    setLatestComp(latest)
    setPrevComp(prev)
    setGoals(g)
  }

  const heightCm = latestComp?.height_cm ?? goals?.height_cm ?? 178
  const latestWeight = weights[weights.length - 1]?.weight_kg ?? null
  const firstWeight = weights[0]?.weight_kg ?? null
  const bfPct = latestComp?.body_fat_pct ?? null
  const leanMassKg = latestWeight != null && bfPct != null ? latestWeight * (1 - bfPct / 100) : null
  const ffmi = latestWeight != null && bfPct != null ? computeFFMI(latestWeight, bfPct, heightCm) : null
  const waistToHeight = latestComp?.waist_cm != null ? latestComp.waist_cm / heightCm : null
  const weightTrend = latestWeight != null && firstWeight != null ? latestWeight - firstWeight : null

  // 7-day weight stats
  const last7 = weights.slice(-7).map(w => w.weight_kg)
  const weightAvg = last7.length ? last7.reduce((s, v) => s + v, 0) / last7.length : null
  const weightMin = last7.length ? Math.min(...last7) : null
  const weightMax = last7.length ? Math.max(...last7) : null

  // Goal weight progress
  const goalWeight = goals?.weight_goal_kg ?? null
  const goalPct =
    goalWeight != null && latestWeight != null && firstWeight != null && Math.abs(goalWeight - firstWeight) > 0.1
      ? Math.min(1, Math.max(0, Math.abs(latestWeight - firstWeight) / Math.abs(goalWeight - firstWeight)))
      : null
  const kgToGoal = goalWeight != null && latestWeight != null ? Math.abs(goalWeight - latestWeight) : null

  const weightSeries = weights.map((w) => ({ x: new Date(w.date).getTime(), y: w.weight_kg }))
  const leanSeries = weights
    .map((w) => {
      const comp = [...comps].reverse().find((c) => c.date <= w.date && c.body_fat_pct != null)
      if (!comp || comp.body_fat_pct == null) return null
      return { x: new Date(w.date).getTime(), y: w.weight_kg * (1 - comp.body_fat_pct / 100) }
    })
    .filter((p): p is { x: number; y: number } => p != null)

  // Bulk/cut quality classification
  let bulkState: 'clean' | 'dirty' | 'cutting' | null = null
  let bulkExplanation = ''
  if (weightTrend != null) {
    const waistComps = comps.filter((c) => c.waist_cm != null)
    const waistTrend =
      waistComps.length >= 2 ? waistComps[waistComps.length - 1].waist_cm! - waistComps[0].waist_cm! : null
    if (weightTrend < -0.2) {
      bulkState = 'cutting'
      bulkExplanation = 'Weight trending down — in a cutting phase.'
    } else if (weightTrend > 0.2) {
      bulkState = waistTrend != null && waistTrend > 1 ? 'dirty' : 'clean'
      bulkExplanation =
        bulkState === 'dirty'
          ? 'Waist rising alongside weight — dirty bulk.'
          : 'Waist stable while weight rising — clean bulk.'
    } else {
      bulkState = 'clean'
      bulkExplanation = 'Weight holding steady.'
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Body</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/body/log-weight')}>
          <Text style={styles.headerBtnText}>Log Weight</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Goal weight ── */}
        {goalWeight != null && latestWeight != null && (
          <View style={styles.card}>
            <View style={styles.goalRow}>
              <View>
                <Text style={styles.cardTitle}>Goal Weight</Text>
                <Text style={styles.goalTarget}>{goalWeight} kg</Text>
              </View>
              <View style={styles.goalRight}>
                <Text style={styles.goalCurrent}>{latestWeight.toFixed(1)} kg now</Text>
                {kgToGoal != null && (
                  <Text style={styles.goalRemain}>{kgToGoal.toFixed(1)} kg to go</Text>
                )}
              </View>
            </View>
            {goalPct != null && (
              <View style={styles.goalTrack}>
                <View style={[styles.goalFill, { width: `${Math.round(goalPct * 100)}%` }]} />
              </View>
            )}
          </View>
        )}

        {/* ── Weight trend chart ── */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>Weight Trend (30 days)</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.accentDark }]} />
                <Text style={styles.legendText}>Weight</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.accentMid }]} />
                <Text style={styles.legendText}>Lean mass</Text>
              </View>
            </View>
          </View>
          <LineChart
            series={[
              { data: weightSeries, color: colors.accentDark },
              { data: leanSeries, color: colors.accentMid, dashed: true },
            ]}
            width={320}
            height={130}
          />
          {weightAvg != null && (
            <View style={styles.weekStatsRow}>
              <WeekStat label="7-day avg" value={`${weightAvg.toFixed(1)} kg`} />
              <WeekStat label="Low" value={`${weightMin!.toFixed(1)} kg`} />
              <WeekStat label="High" value={`${weightMax!.toFixed(1)} kg`} />
              {weightTrend != null && (
                <WeekStat
                  label="30-day trend"
                  value={`${weightTrend >= 0 ? '+' : ''}${weightTrend.toFixed(1)} kg`}
                  color={weightTrend > 0 ? colors.accentMid : '#3d6fb0'}
                />
              )}
            </View>
          )}
        </View>

        {/* ── Key metrics ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: sp.md }} contentContainerStyle={{ gap: sp.sm }}>
          <MetricCard label="Body Fat %" value={bfPct != null ? `${bfPct.toFixed(1)}%` : '—'} />
          <MetricCard label="Lean Mass" value={leanMassKg != null ? `${leanMassKg.toFixed(1)}kg` : '—'} />
          <MetricCard label="FFMI" value={ffmi != null ? ffmi.toFixed(1) : '—'} note="Natural ceiling: 25" />
          <MetricCard label="Waist:Height" value={waistToHeight != null ? waistToHeight.toFixed(2) : '—'} />
        </ScrollView>

        {/* ── Circumferences ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>Measurements</Text>
          {latestComp && (
            <Text style={styles.sectionDate}>Last: {format(new Date(latestComp.date), 'MMM d')}</Text>
          )}
        </View>
        <View style={styles.circGrid}>
          {CIRCUMFERENCE_FIELDS.map((f) => {
            const value = latestComp?.[f.key] as number | null | undefined
            const prevValue = prevComp?.[f.key] as number | null | undefined
            const delta = value != null && prevValue != null ? value - prevValue : null
            return (
              <View key={f.key} style={styles.circCell}>
                <Text style={styles.circLabel}>{f.label}</Text>
                <Text style={styles.circValue}>{value != null ? `${value}cm` : '—'}</Text>
                {delta != null && (
                  <View style={styles.deltaRow}>
                    <Ionicons
                      name={delta > 0 ? 'arrow-up' : delta < 0 ? 'arrow-down' : 'remove'}
                      size={10}
                      color={delta === 0 ? colors.textMuted : delta > 0 ? '#c98a2e' : colors.accentMid}
                    />
                    <Text style={[styles.deltaText, { color: delta === 0 ? colors.textMuted : delta > 0 ? '#c98a2e' : colors.accentMid }]}>
                      {Math.abs(delta).toFixed(1)}cm
                    </Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>
        <TouchableOpacity style={styles.logMeasureBtn} onPress={() => router.push('/body/log-composition')} activeOpacity={0.88}>
          <Text style={styles.logMeasureBtnText}>Log Measurements</Text>
        </TouchableOpacity>

        {/* ── Bulk/cut quality ── */}
        {bulkState && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bulk / Cut Quality</Text>
            <View style={styles.trafficRow}>
              <TrafficState label="Clean Bulk" color={colors.accentMid} active={bulkState === 'clean'} />
              <TrafficState label="Dirty Bulk" color="#c98a2e" active={bulkState === 'dirty'} />
              <TrafficState label="Cutting" color="#3d6fb0" active={bulkState === 'cutting'} />
            </View>
            <Text style={styles.bulkExplanation}>{bulkExplanation}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function WeekStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={weekStatStyles.cell}>
      <Text style={weekStatStyles.label}>{label}</Text>
      <Text style={[weekStatStyles.value, color ? { color } : undefined]}>{value}</Text>
    </View>
  )
}

const weekStatStyles = StyleSheet.create({
  cell: { alignItems: 'center', flex: 1 },
  label: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 9, marginBottom: 2 },
  value: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.xs },
})

function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {note && <Text style={styles.metricNote}>{note}</Text>}
    </View>
  )
}

function TrafficState({ label, color, active }: { label: string; color: string; active: boolean }) {
  return (
    <View style={styles.trafficItem}>
      <View style={[styles.trafficDot, { borderColor: color, backgroundColor: active ? color : 'transparent' }]} />
      <Text style={[styles.trafficLabel, active && { color }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: sp.md, paddingTop: sp.sm, paddingBottom: sp.sm,
  },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 22 },
  headerBtn: { backgroundColor: colors.accentLime, borderRadius: r.full, paddingHorizontal: 14, paddingVertical: 8 },
  headerBtnText: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.xs },
  content: { padding: sp.md, paddingTop: 0, paddingBottom: 120 },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: r.lg, padding: sp.md, marginBottom: sp.md,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.sm },
  cardTitle: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  legendRow: { flexDirection: 'row', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 10 },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: sp.sm },
  goalTarget: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 28, marginTop: 2 },
  goalRight: { alignItems: 'flex-end' },
  goalCurrent: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs },
  goalRemain: { color: colors.accentMid, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginTop: 4 },
  goalTrack: { height: 6, backgroundColor: colors.surfaceInput, borderRadius: 3, overflow: 'hidden' },
  goalFill: { height: '100%', backgroundColor: colors.accentLime, borderRadius: 3 },
  weekStatsRow: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border,
    marginTop: sp.sm, paddingTop: sp.sm,
  },
  metricCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: r.lg, padding: sp.md, width: 130,
  },
  metricLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginBottom: 6 },
  metricValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.xl },
  metricNote: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 9, marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  sectionLabel: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  sectionDate: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.xs },
  circGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp.sm, marginBottom: sp.md },
  circCell: {
    width: '47%', backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, borderRadius: r.md, padding: 12,
  },
  circLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs },
  circValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.md, marginTop: 4 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3 },
  deltaText: { fontFamily: fonts.mono, fontSize: 10 },
  logMeasureBtn: {
    backgroundColor: colors.textPrimary, borderRadius: r.lg,
    paddingVertical: 15, alignItems: 'center', marginBottom: sp.md,
  },
  logMeasureBtnText: { color: '#fff', fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  trafficRow: { flexDirection: 'row', gap: sp.md, marginTop: sp.sm, marginBottom: sp.sm },
  trafficItem: { flex: 1, alignItems: 'center', gap: 6 },
  trafficDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  trafficLabel: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: fs.xs },
  bulkExplanation: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.sm, textAlign: 'center' },
})
