import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { format, isToday, isYesterday, startOfWeek, addDays, isSameDay } from 'date-fns'
import { colors, sp, r, fs } from '../../lib/theme'
import {
  getRecentWorkouts,
  getExercisesByName,
  getWorkoutStats,
  createWorkout,
  addWorkoutExercise,
  getPreviousSets,
} from '../../lib/db/queries'
import { useWorkoutStore } from '../../lib/store/workout'
import { TEMPLATES } from '../../lib/templates'
import type { Workout, ActiveExercise } from '../../lib/types'

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function HomeScreen() {
  const db = useSQLiteContext()
  const router = useRouter()
  const { isActive, workoutName } = useWorkoutStore()
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([])
  const [lastStats, setLastStats] = useState<{
    exercise_count: number
    set_count: number
    volume: number
  } | null>(null)
  const [workoutDays, setWorkoutDays] = useState<number[]>([])

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    const ws = await getRecentWorkouts(db, 10)
    setRecentWorkouts(ws)
    if (ws.length > 0) {
      const stats = await getWorkoutStats(db, ws[0].id)
      setLastStats(stats ?? null)
    }
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const days: number[] = []
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i)
      if (ws.some((w) => isSameDay(new Date(w.started_at), day))) {
        days.push(i)
      }
    }
    setWorkoutDays(days)
  }

  async function handleStartWorkout(templateIndex: number) {
    const template = TEMPLATES[templateIndex]
    const exercises = await getExercisesByName(
      db,
      template.exercises.map((e) => e.name)
    )
    const workoutId = await createWorkout(db, template.name)
    const activeExercises: ActiveExercise[] = []

    for (let i = 0; i < template.exercises.length; i++) {
      const tmpl = template.exercises[i]
      const ex = exercises.find((e) => e.name === tmpl.name)
      if (!ex) continue

      const weId = await addWorkoutExercise(db, workoutId, ex.id, i)
      const prevSets = await getPreviousSets(db, ex.id)

      activeExercises.push({
        workoutExerciseId: weId,
        exerciseId: ex.id,
        name: ex.name,
        muscleGroup: ex.muscle_group,
        equipment: ex.equipment,
        sets: Array.from({ length: tmpl.sets }, (_, idx) => ({
          setNumber: idx + 1,
          weightKg: prevSets[idx]?.weight_kg ? String(prevSets[idx].weight_kg) : '',
          reps: prevSets[idx]?.reps ? String(prevSets[idx].reps) : '',
          completed: false,
          isPR: false,
        })),
        previousSets: prevSets.map((p) => ({
          weightKg: p.weight_kg,
          reps: p.reps,
        })),
      })
    }

    useWorkoutStore.getState().startWorkout(workoutId, template.name, activeExercises)
    router.push('/workout/active')
  }

  const lastWorkout = recentWorkouts[0]
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })

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
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.name}>Stefan</Text>
          </View>
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={15} color={colors.accentWarm} />
            <Text style={styles.streakText}>{recentWorkouts.length} total</Text>
          </View>
        </View>

        {/* Active workout resume banner */}
        {isActive && (
          <TouchableOpacity
            style={styles.activeBanner}
            onPress={() => router.push('/workout/active')}
            activeOpacity={0.85}
          >
            <View style={styles.activePulse} />
            <Text style={styles.activeBannerText}>
              Workout in progress · {workoutName}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.accent} />
          </TouchableOpacity>
        )}

        {/* Last workout card */}
        {lastWorkout && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>LAST WORKOUT</Text>
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{lastWorkout.name}</Text>
                <Text style={styles.cardDate}>{fmtDate(lastWorkout.started_at)}</Text>
              </View>
              {lastStats && (
                <View style={styles.statsRow}>
                  <Stat
                    icon="barbell-outline"
                    value={String(lastStats.exercise_count)}
                    label="exercises"
                  />
                  <Stat
                    icon="checkmark-circle-outline"
                    value={String(lastStats.set_count)}
                    label="sets"
                  />
                  <Stat
                    icon="trending-up-outline"
                    value={fmtVolume(lastStats.volume)}
                    label="kg vol"
                  />
                </View>
              )}
            </View>
          </View>
        )}

        {/* Weekly calendar */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>THIS WEEK</Text>
          <View style={styles.week}>
            {WEEK_LABELS.map((label, i) => {
              const day = addDays(weekStart, i)
              const today = isToday(day)
              const done = workoutDays.includes(i)
              const future = day > new Date() && !today
              return (
                <View key={i} style={styles.dayCol}>
                  <Text
                    style={[styles.dayLabel, today && { color: colors.accent }]}
                  >
                    {label}
                  </Text>
                  <View
                    style={[
                      styles.dayDot,
                      done && { backgroundColor: colors.success },
                      today && !done && {
                        borderWidth: 2,
                        borderColor: colors.accent,
                      },
                      future && { opacity: 0.25 },
                    ]}
                  />
                </View>
              )
            })}
          </View>
        </View>

        {/* Start Workout CTA */}
        {!isActive && (
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => handleStartWorkout(0)}
            activeOpacity={0.88}
          >
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.startBtnText}>Start Workout</Text>
          </TouchableOpacity>
        )}

        {/* Quick template chips */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUICK START</Text>
          <View style={styles.templateRow}>
            {TEMPLATES.map((t, i) => (
              <TouchableOpacity
                key={t.name}
                style={[styles.templateChip, { borderColor: t.color + '55' }]}
                onPress={() => handleStartWorkout(i)}
                activeOpacity={0.8}
              >
                <View style={[styles.templateDot, { backgroundColor: t.color }]} />
                <Text style={styles.templateLabel}>{t.tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* History */}
        {recentWorkouts.length > 0 && (
          <View style={[styles.section, { marginBottom: 32 }]}>
            <Text style={styles.sectionLabel}>RECENT</Text>
            {recentWorkouts.slice(0, 5).map((w) => (
              <View key={w.id} style={styles.historyRow}>
                <View style={styles.historyDot} />
                <Text style={styles.historyName}>{w.name}</Text>
                <Text style={styles.historyDate}>{fmtDate(w.started_at)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  value: string
  label: string
}) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon} size={12} color={colors.textSecondary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning,'
  if (h < 17) return 'Good afternoon,'
  return 'Good evening,'
}

function fmtDate(ts: number) {
  const d = new Date(ts)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEE, MMM d')
}

function fmtVolume(v: number) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return String(Math.round(v))
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: sp.md, paddingTop: sp.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp.lg,
    marginTop: sp.xs,
  },
  greeting: { color: colors.textSecondary, fontSize: fs.sm },
  name: { color: colors.textPrimary, fontSize: fs.xxl, fontWeight: '800', marginTop: 1 },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: r.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakText: { color: colors.textPrimary, fontSize: fs.sm, fontWeight: '600' },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accent + '18',
    borderRadius: r.md,
    padding: sp.md,
    marginBottom: sp.md,
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  activePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  activeBannerText: { flex: 1, color: colors.accent, fontSize: fs.sm, fontWeight: '600' },
  section: { marginBottom: sp.lg },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: fs.xs,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: sp.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: r.lg,
    padding: sp.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp.sm,
  },
  cardTitle: { color: colors.textPrimary, fontSize: fs.lg, fontWeight: '700' },
  cardDate: { color: colors.textSecondary, fontSize: fs.sm },
  statsRow: { flexDirection: 'row', gap: sp.sm },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: r.sm,
  },
  statValue: { color: colors.textPrimary, fontSize: fs.sm, fontWeight: '600' },
  statLabel: { color: colors.textSecondary, fontSize: fs.xs },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: r.lg,
    padding: sp.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayCol: { alignItems: 'center', gap: 6 },
  dayLabel: { color: colors.textSecondary, fontSize: fs.xs, fontWeight: '600' },
  dayDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceElevated,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: r.lg,
    paddingVertical: 18,
    marginBottom: sp.lg,
  },
  startBtnText: { color: '#fff', fontSize: fs.lg, fontWeight: '700', letterSpacing: 0.3 },
  templateRow: { flexDirection: 'row', gap: sp.sm },
  templateChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: r.md,
    paddingVertical: 13,
    borderWidth: 1,
  },
  templateDot: { width: 8, height: 8, borderRadius: 4 },
  templateLabel: { color: colors.textPrimary, fontSize: fs.sm, fontWeight: '600' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    paddingVertical: sp.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  historyName: { flex: 1, color: colors.textPrimary, fontSize: fs.md, fontWeight: '500' },
  historyDate: { color: colors.textSecondary, fontSize: fs.sm },
})
