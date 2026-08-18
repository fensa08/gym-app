import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useState, useCallback, useEffect } from 'react'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Circle } from 'react-native-svg'
import { Ionicons } from '@expo/vector-icons'
import { format } from 'date-fns'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import {
  getWeeklyVolume,
  getAllPRs,
  getRecentWorkouts,
  getMonthlyVolume,
  getWeeklyVolumeByMuscleGroup,
  getTrainingFrequencyByMuscleGroup,
  getExercisesWithHistory,
  getExerciseHistory,
  getWorkoutVolumeInRange,
  type WeeklyMuscleGroupVolume,
  type WeeklyMuscleGroupFrequency,
  type ExerciseHistoryPoint,
} from '../../lib/firestore/queries'
import {
  getBodyWeightLogs,
  getBodyWeightLogsRange,
  getBodyCompositionHistory,
  getUserGoals,
  getRecoveryLogs,
  readinessScore,
  getNutritionLogs,
  getNutritionLogsRange,
  getStaleExercises,
  getMaintenanceCalibration,
} from '../../lib/firestore/queriesHealth'
import { computeFFMI, getTopInsight, SIGNAL_COLORS, type SignalColor } from '../../lib/insights'
import {
  rollingAverageByDate,
  proteinPerKgSeries,
  nightsBelowThreshold,
  weeklyAverages,
  classifyTrend,
  average,
  TARGET_FREQUENCY_PER_MUSCLE_GROUP,
  type Trend,
} from '../../lib/statsAggregation'
import { CategoryTabRow } from '../../components/CategoryTabRow'
import { LineChart, BarChart, DivergingBarChart, BarWithLineChart, type LineSeries } from '../../components/Charts'
import { StatChip } from '../../components/Cards'
import type { BodyWeightLog, BodyCompositionLog, RecoveryLog, NutritionLog } from '../../lib/types'

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const BAR_HEIGHT = 100
const RING_R = 30
const RING_CIRC = 2 * Math.PI * RING_R
const MONTHLY_GOAL = 80000
const SLEEP_THRESHOLD_HOURS = 7
const PROTEIN_BAND_G_PER_KG = { min: 1.6, max: 2.2 }

const MUSCLE_GROUP_COLORS: Record<string, string> = {
  Chest: colors.accentLime,
  Back: colors.accentMid,
  Legs: colors.accentDark,
  Shoulders: '#3d6fb0',
  Biceps: '#c98a2e',
  Triceps: colors.error,
  Core: '#8a6fb0',
}

function trendArrow(trend: Trend): string {
  return trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'
}

function CardHeaderLink({ title, label = 'Details', onPress }: { title: string; label?: string; onPress: () => void }) {
  return (
    <View style={styles.cardHeaderRow}>
      <Text style={styles.cardTitle}>{title}</Text>
      <TouchableOpacity onPress={onPress} hitSlop={8} style={styles.detailsBtn}>
        <Text style={styles.detailsBtnText}>{label}</Text>
        <Ionicons name="chevron-forward" size={13} color={colors.accentMid} />
      </TouchableOpacity>
    </View>
  )
}

type StatsTab = 'overview' | 'training' | 'body' | 'recovery' | 'nutrition' | 'insights'
const TABS: { key: StatsTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'training', label: 'Training' },
  { key: 'body', label: 'Body' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'insights', label: 'Insights' },
]

export default function StatsScreen() {
  const router = useRouter()
  const [tab, setTab] = useState<StatsTab>('overview')

  // Training tab state (unchanged)
  const [range, setRange] = useState<'weekly' | 'monthly'>('weekly')
  const [weeklyBars, setWeeklyBars] = useState<{ day: string; heightPct: number; volume: number }[]>([])
  const [totalWeekVol, setTotalWeekVol] = useState(0)
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0)
  const [monthlyVol, setMonthlyVol] = useState(0)
  const [prs, setPrs] = useState<{ exercise_name: string; weight_kg: number; reps: number; completed_at: number }[]>([])
  const [mgVolume, setMgVolume] = useState<WeeklyMuscleGroupVolume[]>([])
  const [mgFrequency, setMgFrequency] = useState<WeeklyMuscleGroupFrequency[]>([])
  const [exerciseList, setExerciseList] = useState<{ exerciseId: string; name: string }[]>([])
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistoryPoint[]>([])

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
  const [carbsGoal, setCarbsGoal] = useState(250)
  const [fatGoal, setFatGoal] = useState(75)

  // Insights tab state
  const [topInsight, setTopInsight] = useState<{ headline: string; color: SignalColor } | null>(null)
  const [staleCount, setStaleCount] = useState(0)
  const [calibrationReady, setCalibrationReady] = useState(false)

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  useEffect(() => {
    if (!selectedExerciseId) return
    getExerciseHistory(selectedExerciseId, 90).then(setExerciseHistory)
  }, [selectedExerciseId])

  async function loadData() {
    const [volumeRows, allPrs, recent, monthly, mgVol, mgFreq, exercises] = await Promise.all([
      getWeeklyVolume(),
      getAllPRs(),
      getRecentWorkouts(100),
      getMonthlyVolume(),
      getWeeklyVolumeByMuscleGroup(5),
      getTrainingFrequencyByMuscleGroup(5),
      getExercisesWithHistory(),
    ])
    setMgVolume(mgVol)
    setMgFrequency(mgFreq)
    setExerciseList(exercises)
    setSelectedExerciseId((prev) => prev ?? exercises[0]?.exerciseId ?? null)
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
    setCarbsGoal(goals.carbs_goal)
    setFatGoal(goals.fat_goal)

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
        <CategoryTabRow tabs={TABS} active={tab} onChange={setTab} />

        {tab === 'overview' && (
          <OverviewTab calorieGoal={calorieGoal} proteinGoal={proteinGoal} carbsGoal={carbsGoal} fatGoal={fatGoal} />
        )}
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
            mgVolume={mgVolume}
            mgFrequency={mgFrequency}
            exerciseList={exerciseList}
            selectedExerciseId={selectedExerciseId}
            onSelectExercise={setSelectedExerciseId}
            exerciseHistory={exerciseHistory}
          />
        )}
        {tab === 'body' && <BodyTab weights={weights} comps={comps} heightCm={heightCm} />}
        {tab === 'recovery' && <RecoveryTab logs={recoveryLogs} />}
        {tab === 'nutrition' && (
          <NutritionTab logs={nutritionLogs} calorieGoal={calorieGoal} proteinGoal={proteinGoal} weights={weights} />
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

// ── Overview tab: per-week rollup with prev/next navigation ──────────
function currentWeekBounds(offset = 0) {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const prevMonday = new Date(monday)
  prevMonday.setDate(monday.getDate() - 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const prevSunday = new Date(prevMonday)
  prevSunday.setDate(prevMonday.getDate() + 6)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { curStart: iso(monday), curEnd: iso(sunday), prevStart: iso(prevMonday), prevEnd: iso(prevSunday) }
}

function deltaLine(cur: number | null, prev: number | null, unit: string, digits = 0): string {
  if (cur == null || prev == null) return 'No data for last week yet'
  const diff = cur - prev
  const arrow = diff > 0.5 * Math.pow(10, -digits) ? '↑' : diff < -0.5 * Math.pow(10, -digits) ? '↓' : '→'
  const sign = diff > 0 ? '+' : ''
  return `${arrow} ${sign}${diff.toFixed(digits)}${unit} vs last week`
}

function OverviewTab({
  calorieGoal,
  proteinGoal,
  carbsGoal,
  fatGoal,
}: {
  calorieGoal: number
  proteinGoal: number
  carbsGoal: number
  fatGoal: number
}) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [curNutrition, setCurNutrition] = useState<NutritionLog[]>([])
  const [prevNutrition, setPrevNutrition] = useState<NutritionLog[]>([])
  const [curWeights, setCurWeights] = useState<BodyWeightLog[]>([])
  const [prevWeights, setPrevWeights] = useState<BodyWeightLog[]>([])
  const [curTraining, setCurTraining] = useState({ volume: 0, sessions: 0 })
  const [prevTraining, setPrevTraining] = useState<{ volume: number; sessions: number } | null>(null)
  const router = useRouter()

  const isCurrentWeek = weekOffset === 0
  const { curStart, curEnd, prevStart, prevEnd } = currentWeekBounds(weekOffset)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      getNutritionLogsRange(curStart, curEnd),
      getNutritionLogsRange(prevStart, prevEnd),
      getBodyWeightLogsRange(curStart, curEnd),
      getBodyWeightLogsRange(prevStart, prevEnd),
      getWorkoutVolumeInRange(curStart, curEnd),
      getWorkoutVolumeInRange(prevStart, prevEnd),
    ]).then(([curNut, prevNut, curW, prevW, curVol, prevVol]) => {
      if (cancelled) return
      setCurNutrition(curNut)
      setPrevNutrition(prevNut)
      setCurWeights(curW)
      setPrevWeights(prevW)
      setCurTraining(curVol)
      setPrevTraining(prevVol)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [curStart, curEnd, prevStart, prevEnd])

  const curLoggedDays = curNutrition.filter((l) => l.calories != null)
  const prevLoggedDays = prevNutrition.filter((l) => l.calories != null)

  const avgCalCur = average(curLoggedDays.map((l) => l.calories!))
  const avgCalPrev = average(prevLoggedDays.map((l) => l.calories!))
  const avgProteinCur = average(curLoggedDays.map((l) => l.protein_g!))
  const avgCarbsCur = average(curLoggedDays.map((l) => l.carbs_g!))
  const avgFatCur = average(curLoggedDays.map((l) => l.fat_g!))

  const deficit = avgCalCur != null ? avgCalCur - calorieGoal : null
  const proteinDaysCur = curLoggedDays.filter((l) => l.protein_g != null)
  const proteinHitCur = proteinDaysCur.filter((l) => l.protein_g! >= proteinGoal)
  const proteinPct = proteinDaysCur.length > 0 ? Math.round((proteinHitCur.length / proteinDaysCur.length) * 100) : null

  const avgWeightCur = average(curWeights.map((w) => w.weight_kg))
  const avgWeightPrev = average(prevWeights.map((w) => w.weight_kg))

  const curVolTotal = curTraining.volume
  const prevVolTotal = prevTraining?.volume ?? null

  const calorieByDate = new Map(curNutrition.filter((l) => l.calories != null).map((l) => [l.date, l.calories!] as const))
  const weekStartDate = new Date(curStart)
  const calorieBars = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate)
    d.setDate(weekStartDate.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    return { label: WEEK_LABELS[i], value: calorieByDate.get(iso) ?? 0 }
  })

  return (
    <>
      <View style={styles.card}>
        <View style={styles.weekNavRow}>
          <TouchableOpacity onPress={() => setWeekOffset((o) => o - 1)} hitSlop={10} style={styles.weekNavBtn}>
            <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.cardTitle, styles.weekNavTitle]}>
            Week of {format(new Date(curStart), 'MMM d')} – {format(new Date(curEnd), 'MMM d')}
          </Text>
          <TouchableOpacity
            onPress={() => !isCurrentWeek && setWeekOffset((o) => o + 1)}
            hitSlop={10}
            style={styles.weekNavBtn}
            disabled={isCurrentWeek}
          >
            <Ionicons name="chevron-forward" size={18} color={isCurrentWeek ? colors.border : colors.textPrimary} />
          </TouchableOpacity>
        </View>
        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : (
          <View style={styles.statsRow}>
            <StatChip label="Protein hit rate" value={proteinPct != null ? `${proteinPct}%` : '—'} />
            <StatChip label="Sessions" value={String(curTraining.sessions)} />
            <StatChip label="Volume" value={`${fmtVol(curVolTotal)} kg`} />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <CardHeaderLink title="Calories & Deficit" label="View All" onPress={() => router.push('/stats/calories')} />
        {avgCalCur == null ? (
          <Text style={styles.emptyText}>Log meals this week to see your calorie average</Text>
        ) : (
          <>
            <BarChart data={calorieBars} goalLine={calorieGoal} height={110} />
            <Text style={styles.chartCaption}>Dashed line = {calorieGoal} kcal goal</Text>
            <View style={styles.calorieSplitRow}>
              <View style={styles.calorieSplitHalf}>
                <Text style={styles.bigStat}>{Math.round(avgCalCur)}</Text>
                <Text style={styles.calorieSplitLabel}>kcal / day</Text>
              </View>
              <View style={[styles.calorieSplitHalf, styles.calorieSplitHalfBorder]}>
                <Text style={styles.bigStat}>{deficit != null ? Math.abs(Math.round(deficit)) : '—'}</Text>
                <Text style={styles.calorieSplitLabel}>
                  {deficit != null && deficit < 0 ? 'kcal / day deficit' : deficit != null && deficit > 0 ? 'kcal / day surplus' : 'on target'}
                </Text>
              </View>
            </View>
            <Text style={styles.chartCaption}>{deltaLine(avgCalCur, avgCalPrev, ' kcal')}</Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Macros (avg/day this week)</Text>
        {avgProteinCur == null ? (
          <Text style={styles.emptyText}>Log meals this week to see macro averages</Text>
        ) : (
          <View style={styles.statsRow}>
            <StatChip label={`Protein / ${proteinGoal}g`} value={`${Math.round(avgProteinCur)}g`} />
            <StatChip label={`Carbs / ${carbsGoal}g`} value={`${Math.round(avgCarbsCur ?? 0)}g`} />
            <StatChip label={`Fat / ${fatGoal}g`} value={`${Math.round(avgFatCur ?? 0)}g`} />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <CardHeaderLink title="Body Weight" label="View More" onPress={() => router.push('/stats/bodyweight')} />
        {avgWeightCur == null ? (
          <Text style={styles.emptyText}>Log weight this week to see the trend</Text>
        ) : (
          <>
            <Text style={styles.bigStat}>{avgWeightCur.toFixed(1)} kg</Text>
            <Text style={styles.chartCaption}>{deltaLine(avgWeightCur, avgWeightPrev, ' kg', 1)}</Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <CardHeaderLink title="Training Volume" label="View More" onPress={() => router.push('/stats/volume')} />
        <Text style={styles.bigStat}>{fmtVol(curVolTotal)} kg</Text>
        <Text style={styles.chartCaption}>
          {prevVolTotal != null ? deltaLine(curVolTotal, prevVolTotal, ' kg') : 'No data for last week yet'}
        </Text>
      </View>
    </>
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
  mgVolume,
  mgFrequency,
  exerciseList,
  selectedExerciseId,
  onSelectExercise,
  exerciseHistory,
}: {
  range: 'weekly' | 'monthly'
  setRange(r: 'weekly' | 'monthly'): void
  weeklyBars: { day: string; heightPct: number; volume: number }[]
  totalWeekVol: number
  sessionsThisWeek: number
  monthlyVol: number
  monthlyPct: number
  prs: { exercise_name: string; weight_kg: number; reps: number; completed_at: number }[]
  mgVolume: WeeklyMuscleGroupVolume[]
  mgFrequency: WeeklyMuscleGroupFrequency[]
  exerciseList: { exerciseId: string; name: string }[]
  selectedExerciseId: string | null
  onSelectExercise(id: string): void
  exerciseHistory: ExerciseHistoryPoint[]
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

      <MuscleGroupVolumeCard mgVolume={mgVolume} />
      <ProgressiveOverloadCard
        exerciseList={exerciseList}
        selectedExerciseId={selectedExerciseId}
        onSelectExercise={onSelectExercise}
        exerciseHistory={exerciseHistory}
      />
      <TrainingFrequencyCard mgFrequency={mgFrequency} />
    </>
  )
}

function MuscleGroupVolumeCard({ mgVolume }: { mgVolume: WeeklyMuscleGroupVolume[] }) {
  if (mgVolume.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Volume by Muscle Group</Text>
        <Text style={styles.emptyText}>Log workouts to see volume trends per muscle group</Text>
      </View>
    )
  }
  const groups = Array.from(new Set(mgVolume.flatMap((w) => Object.keys(w.byGroup)))).filter(
    (g) => g !== 'Custom'
  )
  const series: LineSeries[] = groups.map((group) => ({
    data: mgVolume.map((w) => ({ x: new Date(w.weekStart).getTime(), y: w.byGroup[group] ?? 0 })),
    color: MUSCLE_GROUP_COLORS[group] ?? colors.textSecondary,
    showLastDot: true,
  }))

  const currentWeek = mgVolume[mgVolume.length - 1]?.byGroup ?? {}
  const prevWeeks = mgVolume.slice(0, -1)

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Volume by Muscle Group</Text>
      {series.some((s) => s.data.length >= 2) ? (
        <LineChart series={series} height={120} />
      ) : (
        <Text style={styles.emptyText}>Log a few more weeks to see trends</Text>
      )}
      <View style={styles.legendRow}>
        {groups.map((group) => (
          <View key={group} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: MUSCLE_GROUP_COLORS[group] ?? colors.textSecondary }]} />
            <Text style={styles.legendText}>{group}</Text>
          </View>
        ))}
      </View>
      <View style={styles.mgTableHeader}>
        <Text style={styles.mgTableHeaderText}>Group</Text>
        <Text style={styles.mgTableHeaderText}>This week</Text>
        <Text style={styles.mgTableHeaderText}>4-wk avg</Text>
      </View>
      {groups.map((group) => {
        const cur = currentWeek[group] ?? 0
        const prevAvg = average(prevWeeks.map((w) => w.byGroup[group] ?? 0)) ?? 0
        return (
          <View key={group} style={styles.mgTableRow}>
            <Text style={styles.mgTableGroup}>{group}</Text>
            <Text style={styles.mgTableValue}>{fmtVol(cur)}</Text>
            <Text style={styles.mgTableValueMuted}>{fmtVol(prevAvg)}</Text>
          </View>
        )
      })}
    </View>
  )
}

function ProgressiveOverloadCard({
  exerciseList,
  selectedExerciseId,
  onSelectExercise,
  exerciseHistory,
}: {
  exerciseList: { exerciseId: string; name: string }[]
  selectedExerciseId: string | null
  onSelectExercise(id: string): void
  exerciseHistory: ExerciseHistoryPoint[]
}) {
  if (exerciseList.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progressive Overload</Text>
        <Text style={styles.emptyText}>Log workouts to track your top-set progress per exercise</Text>
      </View>
    )
  }
  const series = exerciseHistory.map((p) => ({ x: new Date(p.date).getTime(), y: Math.round(p.estimated1RM * 10) / 10 }))
  const latest = exerciseHistory[exerciseHistory.length - 1]
  const router = useRouter()
  const selectedName = exerciseList.find((e) => e.exerciseId === selectedExerciseId)?.name

  return (
    <View style={styles.card}>
      <CardHeaderLink
        title="Progressive Overload"
        onPress={() =>
          selectedExerciseId &&
          router.push({
            pathname: '/stats/[metric]',
            params: { metric: 'progressive-overload', exerciseId: selectedExerciseId, name: selectedName ?? '' },
          })
        }
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exercisePickerRow}>
        {exerciseList.map((ex) => {
          const isActive = ex.exerciseId === selectedExerciseId
          return (
            <TouchableOpacity
              key={ex.exerciseId}
              style={[styles.exercisePill, isActive && styles.exercisePillActive]}
              onPress={() => onSelectExercise(ex.exerciseId)}
              activeOpacity={0.8}
            >
              <Text style={[styles.exercisePillText, isActive && styles.exercisePillTextActive]}>{ex.name}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      <LineChart data={series} height={120} color={colors.accentMid} />
      {latest && (
        <Text style={styles.chartCaption}>
          Est. 1RM {latest.estimated1RM.toFixed(0)} kg · top set {latest.topWeightKg}kg × {latest.topSetReps}
        </Text>
      )}
    </View>
  )
}

function TrainingFrequencyCard({ mgFrequency }: { mgFrequency: WeeklyMuscleGroupFrequency[] }) {
  const groups = Object.keys(TARGET_FREQUENCY_PER_MUSCLE_GROUP)
  const currentWeek = mgFrequency[mgFrequency.length - 1]?.byGroup ?? {}
  const hasData = mgFrequency.length > 0 && Object.keys(currentWeek).length > 0

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Training Frequency This Week</Text>
      {!hasData ? (
        <Text style={styles.emptyText}>Log a workout to see frequency vs target</Text>
      ) : (
        groups.map((group) => {
          const sessions = currentWeek[group] ?? 0
          const target = TARGET_FREQUENCY_PER_MUSCLE_GROUP[group]
          const met = sessions >= target
          return (
            <View key={group} style={styles.freqRow}>
              <Text style={styles.freqLabel}>{group}</Text>
              <Text style={[styles.freqValue, met ? styles.freqValueMet : styles.freqValueBehind]}>
                {sessions} of {target}
              </Text>
            </View>
          )
        })
      )}
    </View>
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

  const weeklyWeights = weeklyAverages(weights.map((w) => ({ date: w.date, value: w.weight_kg })))
  const weeklyWeightSeries = weeklyWeights.map((w) => ({ x: new Date(w.weekStart).getTime(), y: Math.round(w.average * 10) / 10 }))
  const weightTrend = classifyTrend(weeklyWeights.map((w) => w.average))
  const router = useRouter()

  return (
    <>
      <View style={styles.card}>
        <CardHeaderLink title="Weekly Average Weight" onPress={() => router.push('/stats/bodyweight')} />
        {weeklyWeightSeries.length < 2 ? (
          <Text style={styles.emptyText}>Log weight across a couple of weeks to see the trend</Text>
        ) : (
          <>
            <LineChart data={weeklyWeightSeries} height={110} />
            <Text style={styles.chartCaption}>
              {trendArrow(weightTrend)} {weightTrend} · {weeklyWeightSeries[weeklyWeightSeries.length - 1].y} kg this week
            </Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weight Trend (30d, daily)</Text>
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

  // Nightly sleep bars with a 7d rolling average line, flagging nights under threshold.
  const sleepPoints = logs
    .filter((l): l is RecoveryLog & { sleep_hours: number } => l.sleep_hours != null)
    .map((l) => ({ date: l.date, value: l.sleep_hours }))
  const sleepRolling = rollingAverageByDate(sleepPoints, 7)
  const belowNights = new Set(nightsBelowThreshold(sleepPoints.map((p) => ({ date: p.date, hours: p.value })), SLEEP_THRESHOLD_HOURS))
  const sleepBarData = sleepPoints.map((p, i) => ({
    value: p.value,
    lineValue: sleepRolling[i]?.value ?? null,
    below: belowNights.has(p.date),
  }))

  // Resting HR: daily value + 7d rolling average.
  const hrPoints = logs
    .filter((l): l is RecoveryLog & { resting_hr: number } => l.resting_hr != null)
    .map((l) => ({ date: l.date, value: l.resting_hr }))
  const hrRolling = rollingAverageByDate(hrPoints, 7)
  const hrSeries: LineSeries[] = [
    { data: hrPoints.map((p) => ({ x: new Date(p.date).getTime(), y: p.value })), color: colors.borderMed, dashed: true, showLastDot: false },
    { data: hrRolling.map((p) => ({ x: new Date(p.date).getTime(), y: Math.round(p.value * 10) / 10 })), color: colors.error, showLastDot: true },
  ]
  const router = useRouter()

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Readiness Trend (30d)</Text>
        <LineChart data={readinessSeries} height={110} color={colors.accentMid} />
      </View>

      <View style={styles.card}>
        <CardHeaderLink title="Sleep (30d)" onPress={() => router.push('/stats/sleep')} />
        {sleepBarData.length === 0 ? (
          <Text style={styles.emptyText}>Log sleep to see nightly trends</Text>
        ) : (
          <>
            <BarWithLineChart data={sleepBarData} height={100} />
            <Text style={styles.chartCaption}>
              Bars = nightly hours (red = under {SLEEP_THRESHOLD_HOURS}h) · line = 7d avg
            </Text>
          </>
        )}
      </View>

      <View style={styles.statsRow}>
        <StatChip label="Sleep (7d avg)" value={sleep7 != null ? `${sleep7.toFixed(1)}h` : '—'} />
        <StatChip label="Sleep (30d avg)" value={sleep30 != null ? `${sleep30.toFixed(1)}h` : '—'} />
      </View>

      <View style={styles.card}>
        <CardHeaderLink title="Resting Heart Rate (30d)" onPress={() => router.push('/stats/resting-hr')} />
        {hrPoints.length < 2 ? (
          <Text style={styles.emptyText}>Log resting HR to see trends</Text>
        ) : (
          <>
            <LineChart series={hrSeries} height={110} />
            <Text style={styles.chartCaption}>Faint line = daily · red = 7d avg</Text>
          </>
        )}
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
  weights,
}: {
  logs: NutritionLog[]
  calorieGoal: number
  proteinGoal: number
  weights: BodyWeightLog[]
}) {
  const diffBars = logs
    .filter((l) => l.calories != null)
    .map((l) => ({ value: l.calories! - calorieGoal }))

  const loggedProteinDays = logs.filter((l) => l.protein_g != null)
  const hitProteinDays = loggedProteinDays.filter((l) => l.protein_g! >= proteinGoal)
  const adequacyPct =
    loggedProteinDays.length > 0 ? Math.round((hitProteinDays.length / loggedProteinDays.length) * 100) : 0

  // Total daily calories: logged bars + 7d rolling average line.
  const caloriePoints = logs
    .filter((l): l is NutritionLog & { calories: number } => l.calories != null)
    .map((l) => ({ date: l.date, value: l.calories }))
  const calorieRolling = rollingAverageByDate(caloriePoints, 7)
  const calorieBarData = caloriePoints.map((p, i) => ({ value: p.value, lineValue: calorieRolling[i]?.value ?? null }))

  // Protein g/kg bodyweight, target band 1.6-2.2.
  const proteinPerKg = proteinPerKgSeries(
    logs.map((l) => ({ date: l.date, protein_g: l.protein_g })),
    weights.map((w) => ({ date: w.date, weight_kg: w.weight_kg }))
  )
  const proteinPerKgSeriesData = proteinPerKg.map((p) => ({ x: new Date(p.date).getTime(), y: Math.round(p.gramsPerKg * 100) / 100 }))
  const router = useRouter()

  return (
    <>
      <View style={styles.card}>
        <CardHeaderLink title="Total Daily Calories (30d)" onPress={() => router.push('/stats/calories')} />
        {calorieBarData.length === 0 ? (
          <Text style={styles.emptyText}>Log meals to see your calorie trend</Text>
        ) : (
          <>
            <BarWithLineChart data={calorieBarData} height={100} />
            <Text style={styles.chartCaption}>Bars = daily calories · line = 7d rolling average</Text>
          </>
        )}
      </View>

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
        <CardHeaderLink title="Protein Intake (g/kg bodyweight)" onPress={() => router.push('/stats/protein-per-kg')} />
        {proteinPerKgSeriesData.length < 2 ? (
          <Text style={styles.emptyText}>Log meals and bodyweight to see protein per kg</Text>
        ) : (
          <>
            <LineChart data={proteinPerKgSeriesData} height={110} color={colors.accentMid} band={PROTEIN_BAND_G_PER_KG} />
            <Text style={styles.chartCaption}>
              Dashed lines = target band {PROTEIN_BAND_G_PER_KG.min}–{PROTEIN_BAND_G_PER_KG.max} g/kg
            </Text>
          </>
        )}
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
  weekNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp.md },
  weekNavBtn: { padding: 4 },
  weekNavTitle: { flex: 1, textAlign: 'center', marginBottom: 0 },
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
  calorieSplitRow: { flexDirection: 'row', marginTop: sp.md },
  calorieSplitHalf: { flex: 1, alignItems: 'center' },
  calorieSplitHalfBorder: { borderLeftWidth: 1, borderLeftColor: colors.border },
  calorieSplitLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs },
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
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: sp.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 10 },
  mgTableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: sp.md,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mgTableHeaderText: { flex: 1, color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  mgTableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  mgTableGroup: { flex: 1, color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.sm },
  mgTableValue: { flex: 1, color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.sm },
  mgTableValueMuted: { flex: 1, color: colors.textSecondary, fontFamily: fonts.mono, fontSize: fs.sm },
  exercisePickerRow: { gap: 8, paddingBottom: sp.md },
  exercisePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: r.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceInput,
  },
  exercisePillActive: { backgroundColor: colors.accentLime, borderColor: colors.accentLime },
  exercisePillText: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: fs.xs },
  exercisePillTextActive: { color: colors.textPrimary },
  freqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  freqLabel: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.sm },
  freqValue: { fontFamily: fonts.monoSemiBold, fontSize: fs.sm },
  freqValueMet: { color: colors.accentMid },
  freqValueBehind: { color: colors.error },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp.md },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailsBtnText: { color: colors.accentMid, fontFamily: fonts.sansSemiBold, fontSize: fs.xs },
})
