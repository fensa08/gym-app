import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg'
import { SafeAreaView } from 'react-native-safe-area-context'
import { startOfWeek, addDays } from 'date-fns'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { getRecentWorkouts, getWeeklyVolume, getAllPRs, getWorkoutStreak } from '../../lib/firestore/queries'
import {
  getLatestRecoveryLog,
  getTodayNutritionLog,
  getUserGoals,
  getBodyWeightLogs,
  getLatestBodyWeight,
  getDaysSinceLastMeasurement,
  readinessScore,
} from '../../lib/firestore/queriesHealth'
import { getTopInsight, SIGNAL_COLORS, type SignalColor } from '../../lib/insights'
import { useWorkoutStore } from '../../lib/store/workout'
import { TEMPLATES } from '../../lib/templates'
import type { Workout, BodyWeightLog, RecoveryLog, NutritionLog, UserGoals } from '../../lib/types'

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function HomeScreen() {
  const router = useRouter()
  const { isActive } = useWorkoutStore()
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([])
  const [streak, setStreak] = useState(0)
  const [prsThisMonth, setPrsThisMonth] = useState(0)
  const [weeklyBars, setWeeklyBars] = useState<
    { day: string; heightPct: number; color: string; isToday: boolean }[]
  >([])
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0)
  const [recovery, setRecovery] = useState<RecoveryLog | null>(null)
  const [nutrition, setNutrition] = useState<NutritionLog | null>(null)
  const [goals, setGoals] = useState<UserGoals | null>(null)
  const [latestWeight, setLatestWeight] = useState<BodyWeightLog | null>(null)
  const [weightSpark, setWeightSpark] = useState<BodyWeightLog[]>([])
  const [daysSinceMeasurement, setDaysSinceMeasurement] = useState<number | null>(null)
  const [topInsight, setTopInsight] = useState<{ headline: string; color: SignalColor } | null>(null)

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    const ws = await getRecentWorkouts(30)
    setRecentWorkouts(ws)
    setStreak(await getWorkoutStreak())

    const [rec, nut, g, latestW, spark, daysSince, insight] = await Promise.all([
      getLatestRecoveryLog(),
      getTodayNutritionLog(),
      getUserGoals(),
      getLatestBodyWeight(),
      getBodyWeightLogs(7),
      getDaysSinceLastMeasurement(),
      getTopInsight(),
    ])
    setRecovery(rec)
    setNutrition(nut)
    setGoals(g)
    setLatestWeight(latestW)
    setWeightSpark(spark)
    setDaysSinceMeasurement(daysSince)
    setTopInsight(insight)

    const prs = await getAllPRs()
    const now = new Date()
    setPrsThisMonth(
      prs.filter((p) => {
        const d = new Date(p.completed_at)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }).length
    )

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const volumeRows = await getWeeklyVolume()
    const volumeByDay = new Map(volumeRows.map((v) => [v.day, v.volume]))
    let sessions = 0
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    const isoDay = (d: Date) => d.toISOString().slice(0, 10)
    const rawBars = days.map((d) => {
      const vol = volumeByDay.get(isoDay(d)) ?? 0
      if (vol > 0) sessions++
      return { d, vol }
    })
    setSessionsThisWeek(sessions)
    const maxVol = Math.max(...rawBars.map((b) => b.vol), 1)
    setWeeklyBars(
      rawBars.map(({ d, vol }, i) => ({
        day: WEEK_LABELS[i],
        heightPct: vol > 0 ? Math.max(8, Math.round((vol / maxVol) * 100)) : 4,
        color: vol > 0 ? colors.accentLime : colors.border,
        isToday: d.toDateString() === new Date().toDateString(),
      }))
    )
  }

  const suggestedIndex = recentWorkouts.length % TEMPLATES.length
  const suggested = TEMPLATES[suggestedIndex]
  const lastWorkout = recentWorkouts[0]

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.date}>{formatDate()}</Text>
            <Text style={styles.greeting}>{greeting()}</Text>
          </View>
          <LinearGradient
            colors={[colors.accentLime, colors.accentDark]}
            style={styles.avatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.avatarLetter}>A</Text>
          </LinearGradient>
        </View>

        {/* Active workout resume banner */}
        {isActive && (
          <TouchableOpacity
            style={styles.activeBanner}
            onPress={() => router.push('/workout/active')}
            activeOpacity={0.85}
          >
            <View style={styles.activePulse} />
            <Text style={styles.activeBannerText}>Workout in progress — tap to resume</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.accentLime} />
          </TouchableOpacity>
        )}

        {/* Stat chips */}
        <View style={styles.statsRow}>
          <StatChip icon="flame-outline" value={String(streak)} label="day streak" />
          <StatChip icon="git-compare-outline" value={`${sessionsThisWeek}/5`} label="sessions" />
          <StatChip icon="trophy-outline" value={String(prsThisMonth)} label="PRs this month" iconColor={colors.accentMid} />
        </View>

        {/* Today's Workout hero */}
        {!isActive && (
          <LinearGradient
            colors={[colors.accentDark, colors.accentDarker]}
            style={styles.hero}
          >
            <Text style={styles.heroLabel}>Today's Workout</Text>
            <Text style={styles.heroDuration}>~{suggested.duration} min</Text>
            <Text style={styles.heroTitle}>
              {suggested.name} — {suggested.sub}
            </Text>
            <Text style={styles.heroMeta}>
              {suggested.exercises.length} exercises
              {lastWorkout ? ` · last done ${fmtRelative(lastWorkout.started_at)}` : ''}
            </Text>
            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.heroStartBtn}
                onPress={() => router.push('/workout/start')}
                activeOpacity={0.88}
              >
                <Ionicons name="play" size={16} color={colors.textPrimary} />
                <Text style={styles.heroStartText}>Start Workout</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.heroPlanBtn}
                onPress={() => router.push('/workouts')}
                activeOpacity={0.8}
              >
                <Text style={styles.heroPlanText}>Plan</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        )}

        {/* Weekly chart */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>This Week</Text>
            <Text style={styles.cardTrend}>{sessionsThisWeek} sessions</Text>
          </View>
          <View style={styles.bars}>
            {weeklyBars.map((bar, i) => (
              <View key={i} style={styles.barCol}>
                <View
                  style={[styles.barFill, { height: `${bar.heightPct}%`, backgroundColor: bar.color }]}
                />
                <Text style={[styles.barLabel, bar.isToday && styles.barLabelToday]}>{bar.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Readiness */}
        <ReadinessCard recovery={recovery} onPress={() => router.push('/recovery')} />

        {/* Nutrition + Body */}
        <View style={styles.halfRow}>
          <NutritionCard nutrition={nutrition} goals={goals} onPress={() => router.push('/nutrition')} />
          <BodyCard
            weight={latestWeight}
            spark={weightSpark}
            daysSince={daysSinceMeasurement}
            onPress={() => router.push('/body')}
          />
        </View>

        {/* Insights */}
        <TouchableOpacity
          style={[styles.insightsCard, { borderLeftColor: topInsight ? SIGNAL_COLORS[topInsight.color] : colors.border }]}
          onPress={() => router.push('/insights')}
          activeOpacity={0.85}
        >
          <Text style={styles.insightsLabel}>Top Insight</Text>
          <Text style={styles.insightsHeadline}>{topInsight ? topInsight.headline : 'Log a few days of data to unlock insights'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function ReadinessCard({ recovery, onPress }: { recovery: RecoveryLog | null; onPress: () => void }) {
  const score = readinessScore(recovery)
  const ringColor = score == null ? colors.textSecondary : score >= 7 ? colors.accentMid : score >= 5 ? '#c98a2e' : colors.error
  const ringR = 58
  const ringCirc = 2 * Math.PI * ringR
  const pct = score == null ? 0 : Math.max(0, Math.min(1, score / 10))
  return (
    <TouchableOpacity style={styles.readinessCard} onPress={onPress} activeOpacity={0.88}>
      <View style={styles.readinessRingWrap}>
        <Svg width={140} height={140} viewBox="0 0 140 140" style={{ transform: [{ rotate: '-90deg' }] }}>
          <SvgCircle cx={70} cy={70} r={ringR} fill="none" stroke={colors.border} strokeWidth={11} />
          <SvgCircle
            cx={70}
            cy={70}
            r={ringR}
            fill="none"
            stroke={ringColor}
            strokeWidth={11}
            strokeLinecap="round"
            strokeDasharray={`${pct * ringCirc} ${ringCirc}`}
          />
        </Svg>
        <Text style={styles.readinessScore}>{score == null ? '—' : score.toFixed(1)}</Text>
      </View>
      <View style={styles.readinessStatsRow}>
        <MiniStat label="Sleep" value={recovery?.sleep_hours != null ? `${recovery.sleep_hours}h` : '—'} />
        <MiniStat label="HRV" value={recovery?.hrv != null ? `${recovery.hrv}ms` : '—'} />
        <MiniStat label="Resting HR" value={recovery?.resting_hr != null ? `${recovery.resting_hr}bpm` : '—'} />
      </View>
      <Text style={styles.readinessSub}>Based on last night's data</Text>
    </TouchableOpacity>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  )
}

function NutritionCard({
  nutrition,
  goals,
  onPress,
}: {
  nutrition: NutritionLog | null
  goals: UserGoals | null
  onPress: () => void
}) {
  const calGoal = goals?.calorie_goal ?? 2400
  const proteinGoal = goals?.protein_goal ?? 160
  const waterGoal = goals?.water_goal_ml ?? 3000
  const rows = [
    { label: 'Calories', value: nutrition?.calories ?? 0, goal: calGoal, unit: '' },
    { label: 'Protein', value: nutrition?.protein_g ?? 0, goal: proteinGoal, unit: 'g' },
    { label: 'Water', value: nutrition?.water_ml ?? 0, goal: waterGoal, unit: 'ml' },
  ]
  return (
    <TouchableOpacity style={styles.halfCard} onPress={onPress} activeOpacity={0.88}>
      <Text style={styles.halfCardTitle}>Nutrition</Text>
      <View style={{ gap: 10, marginTop: 10 }}>
        {rows.map((row) => {
          const pct = row.goal > 0 ? Math.min(1, row.value / row.goal) : 0
          return (
            <View key={row.label}>
              <View style={styles.miniBarRow}>
                <Text style={styles.miniBarLabel}>{row.label}</Text>
                <Text style={styles.miniBarPct}>{Math.round(pct * 100)}%</Text>
              </View>
              <View style={styles.miniBarTrack}>
                <View style={[styles.miniBarFill, { width: `${pct * 100}%` }]} />
              </View>
            </View>
          )
        })}
      </View>
    </TouchableOpacity>
  )
}

function BodyCard({
  weight,
  spark,
  daysSince,
  onPress,
}: {
  weight: BodyWeightLog | null
  spark: BodyWeightLog[]
  daysSince: number | null
  onPress: () => void
}) {
  const sparkPath = buildSparklinePath(spark)
  return (
    <TouchableOpacity style={styles.halfCard} onPress={onPress} activeOpacity={0.88}>
      <Text style={styles.halfCardTitle}>Body</Text>
      <Text style={styles.bodyWeight}>{weight ? `${weight.weight_kg.toFixed(1)}` : '—'}<Text style={styles.bodyWeightUnit}> kg</Text></Text>
      <Svg width="100%" height={30} viewBox="0 0 100 30" style={{ marginTop: 6 }}>
        {sparkPath && <Path d={sparkPath} stroke={colors.accentMid} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      </Svg>
      <Text style={styles.bodySub}>
        {daysSince == null ? 'No measurements logged' : daysSince === 0 ? 'Measured today' : `${daysSince}d since measurement`}
      </Text>
    </TouchableOpacity>
  )
}

function buildSparklinePath(spark: BodyWeightLog[]): string | null {
  if (spark.length < 2) return null
  const ys = spark.map((s) => s.weight_kg)
  const min = Math.min(...ys)
  const max = Math.max(...ys)
  const range = max - min || 1
  const points = spark.map((s, i) => {
    const x = (i / (spark.length - 1)) * 100
    const y = 28 - ((s.weight_kg - min) / range) * 26
    return [x, y]
  })
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

function StatChip({
  icon,
  value,
  label,
  iconColor = colors.accentDark,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  value: string
  label: string
  iconColor?: string
}) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon} size={16} color={iconColor} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function greeting() {
  const h = new Date().getHours()
  const name = 'Alex'
  if (h < 12) return `Good morning, ${name}`
  if (h < 17) return `Good afternoon, ${name}`
  return `Good evening, ${name}`
}

function formatDate() {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase()
}

function fmtRelative(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: sp.md, paddingTop: sp.sm, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: sp.md,
    marginTop: sp.xs,
  },
  date: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.xs,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  greeting: {
    color: colors.textPrimary,
    fontFamily: fonts.serif,
    fontSize: 30,
    lineHeight: 34,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.md },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentDark,
    borderRadius: r.md,
    padding: sp.md,
    marginBottom: sp.md,
  },
  activePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentLime },
  activeBannerText: {
    flex: 1,
    color: '#fff',
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.sm,
  },
  statsRow: { flexDirection: 'row', gap: sp.sm, marginBottom: sp.sm },
  statChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: 12,
    gap: 6,
  },
  statValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.xl },
  statLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs },
  hero: {
    borderRadius: r.xl,
    padding: sp.md + 4,
    marginTop: sp.sm,
    marginBottom: sp.md,
  },
  heroLabel: {
    color: colors.accentLime,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.xs,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  heroDuration: {
    position: 'absolute',
    top: sp.md + 4,
    right: sp.md + 4,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fonts.sans,
    fontSize: fs.xs,
  },
  heroTitle: {
    color: '#fff',
    fontFamily: fonts.sansBold,
    fontSize: fs.xl,
    marginBottom: 4,
  },
  heroMeta: { color: 'rgba(255,255,255,0.7)', fontFamily: fonts.sans, fontSize: fs.sm, marginBottom: 18 },
  heroActions: { flexDirection: 'row', gap: 10 },
  heroStartBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accentLime,
    borderRadius: r.md,
    paddingVertical: 14,
  },
  heroStartText: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: fs.md },
  heroPlanBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: r.md,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  heroPlanText: { color: '#fff', fontFamily: fonts.sansSemiBold, fontSize: fs.md },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
    marginBottom: sp.md,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: sp.md },
  cardTitle: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  cardTrend: { color: colors.accentMid, fontFamily: fonts.mono, fontSize: fs.sm },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 84 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 6 },
  barFill: { width: '100%', maxWidth: 26, minHeight: 4, borderRadius: 6 },
  barLabel: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 10 },
  barLabelToday: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold },
  sectionLabel: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: 10 },
  readinessCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
    alignItems: 'center',
    marginBottom: sp.md,
  },
  readinessRingWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  readinessScore: { position: 'absolute', color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 44 },
  readinessStatsRow: { flexDirection: 'row', gap: 8, width: '100%', marginTop: sp.md },
  miniStat: { flex: 1, backgroundColor: colors.surfaceInput, borderRadius: r.md, padding: 8, alignItems: 'center' },
  miniStatValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.sm },
  miniStatLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 10, marginTop: 2 },
  readinessSub: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: 10 },
  halfRow: { flexDirection: 'row', gap: sp.sm, marginBottom: sp.md },
  halfCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
  },
  halfCardTitle: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  miniBarRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  miniBarLabel: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: 10 },
  miniBarPct: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 10 },
  miniBarTrack: { height: 5, borderRadius: 3, backgroundColor: colors.surfaceInput },
  miniBarFill: { height: 5, borderRadius: 3, backgroundColor: colors.accentMid },
  bodyWeight: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: fs.xxl, marginTop: 10 },
  bodyWeightUnit: { fontFamily: fonts.sans, fontSize: fs.sm, color: colors.textSecondary },
  bodySub: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 10, marginTop: 4 },
  insightsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderRadius: r.lg,
    padding: sp.md,
    marginBottom: sp.sm,
  },
  insightsLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  insightsHeadline: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: fs.md },
})
