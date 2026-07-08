import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { startOfWeek, addDays } from 'date-fns'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { getRecentWorkouts, getWeeklyVolume, getAllPRs, getWorkoutStreak } from '../../lib/db/queries'
import { useWorkoutStore } from '../../lib/store/workout'
import { buildWorkoutFromTemplate } from '../../lib/workoutHelpers'
import { TEMPLATES } from '../../lib/templates'
import type { Workout } from '../../lib/types'

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function HomeScreen() {
  const db = useSQLiteContext()
  const router = useRouter()
  const { isActive } = useWorkoutStore()
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([])
  const [streak, setStreak] = useState(0)
  const [prsThisMonth, setPrsThisMonth] = useState(0)
  const [weeklyBars, setWeeklyBars] = useState<
    { day: string; heightPct: number; color: string; isToday: boolean }[]
  >([])
  const [sessionsThisWeek, setSessionsThisWeek] = useState(0)

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    const ws = await getRecentWorkouts(db, 30)
    setRecentWorkouts(ws)
    setStreak(await getWorkoutStreak(db))

    const prs = await getAllPRs(db)
    const now = new Date()
    setPrsThisMonth(
      prs.filter((p) => {
        const d = new Date(p.completed_at)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }).length
    )

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const volumeRows = await getWeeklyVolume(db)
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

  async function handleStartWorkout(templateIndex: number) {
    const template = TEMPLATES[templateIndex]
    const { workoutId, exercises } = await buildWorkoutFromTemplate(db, template)
    useWorkoutStore.getState().startWorkout(workoutId, template.name, exercises)
    router.push('/workout/active')
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
                onPress={() => handleStartWorkout(suggestedIndex)}
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

        {/* Coming soon */}
        <Text style={styles.sectionLabel}>More Coming Soon</Text>
        <View style={styles.soonRow}>
          <SoonChip icon="leaf-outline" label="Nutrition" />
          <SoonChip icon="water-outline" label="Hydration" />
          <SoonChip icon="pulse-outline" label="Activity" />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
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

function SoonChip({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
}) {
  return (
    <View style={styles.soonChip}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <Text style={styles.soonLabel}>{label}</Text>
      <View style={styles.soonBadge}>
        <Text style={styles.soonBadgeText}>Soon</Text>
      </View>
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
  soonRow: { flexDirection: 'row', gap: sp.sm },
  soonChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: 12,
    alignItems: 'flex-start',
    gap: 8,
  },
  soonLabel: { color: colors.textMuted, fontFamily: fonts.sansMedium, fontSize: fs.sm },
  soonBadge: {
    backgroundColor: colors.border,
    borderRadius: r.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  soonBadgeText: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
})
