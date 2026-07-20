import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useState, useCallback } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle } from 'react-native-svg'
import { format } from 'date-fns'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { getWeeklyVolume, getAllPRs, getRecentWorkouts, getMonthlyVolume } from '../../lib/firestore/queries'
import {
  getBodyWeightLogs,
  getBodyCompositionHistory,
  getUserGoals,
  getRecoveryLogs,
  readinessScore,
  getNutritionLogs,
  getStaleExercises,
  getMaintenanceCalibration,
} from '../../lib/firestore/queriesHealth'
import { computeFFMI, getTopInsight, SIGNAL_COLORS, type SignalColor } from '../../lib/insights'
import { CategoryTabRow } from '../../components/CategoryTabRow'
import { LineChart, DivergingBarChart } from '../../components/Charts'
import { StatChip } from '../../components/Cards'
import type { BodyWeightLog, BodyCompositionLog, RecoveryLog, NutritionLog } from '../../lib/types'

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const BAR_HEIGHT = 100
const RING_R = 30
const RING_CIRC = 2 * Math.PI * RING_R
const MONTHLY_GOAL = 80000

type StatsTab = 'training' | 'body' | 'recovery' | 'nutrition' | 'insights'
const TABS: { key: StatsTab; label: string }[] = [
  { key: 'training', label: 'Training' },
  { key: 'body', label: 'Body' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'insights', label: 'Insights' },
]

export default function StatsScreen() {
  const router = useRouter()
  const [tab, setTab] = useState<StatsTab>('training')

  // Training tab state (unchanged)
  const [range, setRange] = useState<'weekly' | 'monthly'>('weekly')
  const [weeklyBars, setWeeklyBars] = useState<{ day: string; heightPct: number; volume: number }[]>([])
  const [totalWeekVol, setTotalWeekVol] = useState(0)
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0)
  const [monthlyVol, setMonthlyVol] = useState(0)
  const [prs, setPrs] = useState<{ exercise_name: string; weight_kg: number; reps: number; completed_at: number }[]>([])

  // Body tab state
  const [weights, setWeights] = useState<BodyWeightLog[]>([])
  const [comps, setComps] = useState<BodyCompositionLog[]>([])
  const [heightCm, setHeightCm] = useState(178)

  // Recovery tab state
  const [recoveryLogs, setRecoveryLogs] = useState<RecoveryLog[]>([])

  // Nutrition tab state
  const [nutritionLogs, setNutritionLogs] = useState<NutritionLog[]>([])
  const [calorieGoal, setCalorieGoal] = useState(2400)
  const [proteinGoal, setProteinGoal] = useState(160)

  // Insights tab state
  const [topInsight, setTopInsight] = useState<{ headline: string; color: SignalColor } | null>(null)
  const [staleCount, setStaleCount] = useState(0)
  const [calibrationReady, setCalibrationReady] = useState(false)

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    const [volumeRows, allPrs, recent, monthly] = await Promise.all([
      getWeeklyVolume(),
      getAllPRs(),
      getRecentWorkouts(100),
      getMonthlyVolume(),
    ])
    const today = new Date()
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const volumeByDay = new Map(volumeRows.map((v) => [v.day, v.volume]))
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
    const isoDay = (d: Date) => d.toISOString().slice(0, 10)
    const vols = days.map((d) => volumeByDay.get(isoDay(d)) ?? 0)
    const maxVol = Math.max(...vols, 1)
    setWeeklyBars(
      vols.map((v, i) => ({
        day: WEEK_LABELS[i],
        heightPct: v > 0 ? Math.max(8, Math.round((v / maxVol) * 100)) : 4,
        volume: v,
      }))
    )
    setTotalWeekVol(vols.reduce((s, v) => s + v, 0))
    setSessionsThisWeek(vols.filter((v) => v > 0).length)
    setMonthlyVol(monthly)
    setPrs(allPrs)

    const goals = await getUserGoals()
    setHeightCm(goals.height_cm)
    setCalorieGoal(goals.calorie_goal)
    setProteinGoal(goals.protein_goal)

    const [w, c, rec, nut, stale, calib, insight] = await Promise.all([
      getBodyWeightLogs(30),
      getBodyCompositionHistory(60),
      getRecoveryLogs(30),
      getNutritionLogs(30),
      getStaleExercises(),
      getMaintenanceCalibration(),
      getTopInsight(),
    ])
    setWeights(w)
    setComps(c)
    setRecoveryLogs(rec)
    setNutritionLogs(nut)
    setStaleCount(stale.length)
    setCalibrationReady(calib != null)
    setTopInsight(insight)
  }

  const monthlyPct = Math.min(1, monthlyVol / MONTHLY_GOAL)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Progress</Text>
        <Text style={styles.title}>Your Stats</Text>

        <CategoryTabRow tabs={TABS} active={tab} onChange={setTab} />

        {tab === 'training' && (
          <TrainingTab
            range={range}
            setRange={setRange}
            weeklyBars={weeklyBars}
            totalWeekVol={totalWeekVol}
            sessionsThisWeek={sessionsThisWeek}
            monthlyVol={monthlyVol}
            monthlyPct={monthlyPct}
            prs={prs}
          />
        )}
        {tab === 'body' && <BodyTab weights={weights} comps={comps} heightCm={heightCm} />}
        {tab === 'recovery' && <RecoveryTab logs={recoveryLogs} />}
        {tab === 'nutrition' && (
          <NutritionTab logs={nutritionLogs} calorieGoal={calorieGoal} proteinGoal={proteinGoal} />
        )}
        {tab === 'insights' && (
          <InsightsTab
            topInsight={topInsight}
            staleCount={staleCount}
            calibrationReady={calibrationReady}
            onOpenInsights={() => router.push('/insights')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// ── Training tab (unchanged content, now gated behind tab selection) ──
function TrainingTab({
  range,
  setRange,
  weeklyBars,
  totalWeekVol,
  sessionsThisWeek,
  monthlyVol,
  monthlyPct,
  prs,
}: {
  range: 'weekly' | 'monthly'
  setRange(r: 'weekly' | 'monthly'): void
  weeklyBars: { day: string; heightPct: number; volume: number }[]
  totalWeekVol: number
  sessionsThisWeek: number
  monthlyVol: number
  monthlyPct: number
  prs: { exercise_name: string; weight_kg: number; reps: number; completed_at: number }[]
}) {
  return (
    <>
      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, range === 'weekly' && styles.toggleBtnOn]}
          onPress={() => setRange('weekly')}
        >
          <Text style={[styles.toggleText, range === 'weekly' && styles.toggleTextOn]}>Weekly</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, range === 'monthly' && styles.toggleBtnOn]}
          onPress={() => setRange('monthly')}
        >
          <Text style={[styles.toggleText, range === 'monthly' && styles.toggleTextOn]}>Monthly</Text>
        </TouchableOpacity>
      </View>

      {range === 'weekly' ? (
        <>
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>Volume by Day</Text>
            </View>
            <View style={styles.bars}>
              {weeklyBars.map((bar, i) => (
                <View key={i} style={styles.barCol}>
                  <View style={[styles.barFill, { height: `${bar.heightPct}%` }]} />
                  <Text style={styles.barLabel}>{bar.day}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Total Volume</Text>
              <Text style={styles.summaryValue}>{fmtVol(totalWeekVol)} kg</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Sessions</Text>
              <Text style={styles.summaryValue}>{sessionsThisWeek} of 5</Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.ringRow}>
              <View style={styles.ringWrap}>
                <Svg width={72} height={72} viewBox="0 0 72 72" style={{ transform: [{ rotate: '-90deg' }] }}>
                  <Circle cx={36} cy={36} r={RING_R} fill="none" stroke="rgba(20,30,20,0.08)" strokeWidth={7} />
                  <Circle
                    cx={36}
                    cy={36}
                    r={RING_R}
                    fill="none"
                    stroke={colors.accentMid}
                    strokeWidth={7}
                    strokeLinecap="round"
                    strokeDasharray={`${monthlyPct * RING_CIRC} ${RING_CIRC}`}
                  />
                </Svg>
                <Text style={styles.ringLabel}>{Math.round(monthlyPct * 100)}%</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Monthly Volume</Text>
                <Text style={styles.monthlyVolume}>{fmtVol(monthlyVol)} kg</Text>
                <Text style={styles.monthlyTrend}>Trending up · goal {fmtVol(MONTHLY_GOAL)} kg</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Personal Records</Text>
          <View style={styles.card}>
            {prs.length === 0 ? (
              <Text style={styles.emptyText}>Log workouts to start tracking PRs</Text>
            ) : (
              prs.map((pr, i) => (
                <View key={pr.exercise_name} style={[styles.prRow, i < prs.length - 1 && styles.prRowBorder]}>
                  <View style={styles.prIcon}>
                    <Text style={{ fontSize: 15 }}>🏆</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prName}>{pr.exercise_name}</Text>
                    <Text style={styles.prDate}>{format(new Date(pr.completed_at), 'MMM d')}</Text>
                  </View>
                  <Text style={styles.prWeight}>{pr.weight_kg} kg</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </>
  )
}

// ── Body tab ────────────────────────────────────────────────────────
function BodyTab({
  weights,
  comps,
  heightCm,
}: {
  weights: BodyWeightLog[]
  comps: BodyCompositionLog[]
  heightCm: number
}) {
  const weightSeries = weights.map((w) => ({ x: new Date(w.date).getTime(), y: w.weight_kg }))

  // FFMI history: match each body-comp entry that has a body_fat_pct to the
  // nearest weight log on or before its date, last 8 entries.
  const ffmiHistory = comps
    .filter((c) => c.body_fat_pct != null)
    .map((c) => {
      const w = [...weights].reverse().find((w) => w.date <= c.date)
      if (!w) return null
      return { date: c.date, value: computeFFMI(w.weight_kg, c.body_fat_pct!, heightCm) }
    })
    .filter((v): v is { date: string; value: number } => v != null)
    .slice(-8)

  // Navy BF% history — using all entries with a body_fat_pct rather than
  // filtering strictly to method === 'navy', since restricting to Navy-only
  // measurements makes the chart too sparse to be useful in practice.
  const bfSeries = comps
    .filter((c) => c.body_fat_pct != null)
    .map((c) => ({ x: new Date(c.date).getTime(), y: c.body_fat_pct! }))

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weight Trend (30d)</Text>
        <LineChart data={weightSeries} height={110} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Body Fat % History</Text>
        <LineChart data={bfSeries} height={110} color="#3d6fb0" />
      </View>

      <Text style={styles.sectionLabel}>FFMI History</Text>
      <View style={styles.card}>
        {ffmiHistory.length === 0 ? (
          <Text style={styles.emptyText}>Log body fat % to see FFMI history</Text>
        ) : (
          ffmiHistory
            .slice()
            .reverse()
            .map((row, i) => (
              <View key={row.date} style={[styles.tableRow, i < ffmiHistory.length - 1 && styles.prRowBorder]}>
                <Text style={styles.tableDate}>{format(new Date(row.date), 'MMM d, yyyy')}</Text>
                <Text style={styles.tableValue}>{row.value.toFixed(1)}</Text>
              </View>
            ))
        )}
      </View>
    </>
  )
}

// ── Recovery tab ─────────────────────────────────────────────────────
function RecoveryTab({ logs }: { logs: RecoveryLog[] }) {
  const readinessSeries = logs
    .map((l) => {
      const score = readinessScore(l)
      return score == null ? null : { x: new Date(l.date).getTime(), y: score }
    })
    .filter((p): p is { x: number; y: number } => p != null)

  const last7 = logs.slice(-7)
  const sleep7 = avg(last7.map((l) => l.sleep_hours).filter((v): v is number => v != null))
  const sleep30 = avg(logs.map((l) => l.sleep_hours).filter((v): v is number => v != null))
  const hrvValues = logs.map((l) => l.hrv).filter((v): v is number => v != null)
  const hrvCurrent = logs.length > 0 ? logs[logs.length - 1].hrv : null
  const hrvAvg30 = avg(hrvValues)

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Readiness Trend (30d)</Text>
        <LineChart data={readinessSeries} height={110} color={colors.accentMid} />
      </View>

      <View style={styles.statsRow}>
        <StatChip label="Sleep (7d avg)" value={sleep7 != null ? `${sleep7.toFixed(1)}h` : '—'} />
        <StatChip label="Sleep (30d avg)" value={sleep30 != null ? `${sleep30.toFixed(1)}h` : '—'} />
      </View>
      <View style={styles.statsRow}>
        <StatChip label="HRV (current)" value={hrvCurrent != null ? `${hrvCurrent}ms` : '—'} />
        <StatChip label="HRV (30d avg)" value={hrvAvg30 != null ? `${Math.round(hrvAvg30)}ms` : '—'} />
      </View>
    </>
  )
}

// ── Nutrition tab ─────────────────────────────────────────────────────
function NutritionTab({
  logs,
  calorieGoal,
  proteinGoal,
}: {
  logs: NutritionLog[]
  calorieGoal: number
  proteinGoal: number
}) {
  const diffBars = logs
    .filter((l) => l.calories != null)
    .map((l) => ({ value: l.calories! - calorieGoal }))

  const loggedProteinDays = logs.filter((l) => l.protein_g != null)
  const hitProteinDays = loggedProteinDays.filter((l) => l.protein_g! >= proteinGoal)
  const adequacyPct =
    loggedProteinDays.length > 0 ? Math.round((hitProteinDays.length / loggedProteinDays.length) * 100) : 0

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Calorie Surplus / Deficit (30d)</Text>
        {diffBars.length === 0 ? (
          <Text style={styles.emptyText}>Log meals to see your calorie trend</Text>
        ) : (
          <DivergingBarChart data={diffBars} height={90} />
        )}
        <Text style={styles.chartCaption}>Above the line = surplus vs goal · below = deficit</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Protein Adequacy</Text>
        <Text style={styles.bigStat}>{adequacyPct}%</Text>
        <Text style={styles.emptyText}>
          {hitProteinDays.length} of {loggedProteinDays.length} logged days hit your {proteinGoal}g goal
        </Text>
      </View>
    </>
  )
}

// ── Insights tab ─────────────────────────────────────────────────────
function InsightsTab({
  topInsight,
  staleCount,
  calibrationReady,
  onOpenInsights,
}: {
  topInsight: { headline: string; color: SignalColor } | null
  staleCount: number
  calibrationReady: boolean
  onOpenInsights: () => void
}) {
  return (
    <>
      <TouchableOpacity
        style={[
          styles.insightPreviewCard,
          { borderLeftColor: topInsight ? SIGNAL_COLORS[topInsight.color] : colors.border },
        ]}
        onPress={onOpenInsights}
        activeOpacity={0.85}
      >
        <Text style={styles.sectionLabel}>Top Insight</Text>
        <Text style={styles.insightHeadline}>
          {topInsight ? topInsight.headline : 'Log a few days of data to unlock insights'}
        </Text>
      </TouchableOpacity>

      <View style={styles.statsRow}>
        <StatChip label="Exercises needing change" value={String(staleCount)} />
        <StatChip label="Calorie calibration" value={calibrationReady ? 'Ready' : 'Locked'} />
      </View>

      <TouchableOpacity style={styles.viewAllBtn} onPress={onOpenInsights} activeOpacity={0.88}>
        <Text style={styles.viewAllBtnText}>View All Insights</Text>
      </TouchableOpacity>
    </>
  )
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((s, v) => s + v, 0) / values.length
}

function fmtVol(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return String(Math.round(v))
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: sp.md, paddingBottom: 120 },
  eyebrow: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.xs,
    letterSpacing: 1.2,
    marginBottom: 6,
    marginTop: sp.xs,
  },
  title: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 30, marginBottom: sp.md },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.full,
    padding: 4,
    marginBottom: sp.md,
  },
  toggleBtn: { flex: 1, borderRadius: r.full, paddingVertical: 9, alignItems: 'center' },
  toggleBtnOn: { backgroundColor: colors.accentLime },
  toggleText: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  toggleTextOn: { color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
    marginBottom: sp.md,
  },
  cardTop: { marginBottom: sp.md },
  cardTitle: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: sp.md },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: BAR_HEIGHT },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 6 },
  barFill: { width: '100%', maxWidth: 26, minHeight: 4, borderRadius: 6, backgroundColor: colors.accentLime },
  barLabel: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 10 },
  summaryRow: { flexDirection: 'row', gap: sp.sm },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
  },
  summaryLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginBottom: 6 },
  summaryValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.xl },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  ringWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  ringLabel: {
    position: 'absolute',
    color: colors.textPrimary,
    fontFamily: fonts.monoSemiBold,
    fontSize: fs.sm,
  },
  monthlyVolume: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.xxl, marginTop: 4 },
  monthlyTrend: { color: colors.accentMid, fontFamily: fonts.sans, fontSize: fs.sm, marginTop: 2 },
  sectionLabel: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: 10 },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  prRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  prIcon: {
    width: 34,
    height: 34,
    borderRadius: r.sm,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prName: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.md },
  prDate: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: 1 },
  prWeight: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.md },
  emptyText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm, textAlign: 'center', paddingVertical: sp.md },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  tableDate: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm },
  tableValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.md },
  statsRow: { flexDirection: 'row', gap: sp.sm, marginBottom: sp.sm },
  chartCaption: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 10, marginTop: sp.sm, textAlign: 'center' },
  bigStat: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: fs.xxxl, marginBottom: 4 },
  insightPreviewCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: r.lg,
    padding: sp.md,
    marginBottom: sp.md,
  },
  insightHeadline: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: fs.md },
  viewAllBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: r.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  viewAllBtnText: { color: '#fff', fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
})
