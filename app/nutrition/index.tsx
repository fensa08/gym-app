import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { ProgressRing } from '../../components/Ring'
import { BarChart } from '../../components/Charts'
import {
  getTodayNutritionLog,
  getUserGoals,
  getNutritionLogs,
  getNutritionStreaks,
  upsertNutritionLog,
} from '../../lib/firestore/queriesHealth'
import type { NutritionLog, UserGoals } from '../../lib/types'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function NutritionHubScreen() {
  const router = useRouter()
  const [today, setToday] = useState<NutritionLog | null>(null)
  const [goals, setGoals] = useState<UserGoals | null>(null)
  const [weekLogs, setWeekLogs] = useState<NutritionLog[]>([])
  const [streaks, setStreaks] = useState({ surplusStreak: 0, deficitStreak: 0 })

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    const g = await getUserGoals()
    const [t, week, streak] = await Promise.all([
      getTodayNutritionLog(),
      getNutritionLogs(7),
      getNutritionStreaks(g.calorie_goal),
    ])
    setGoals(g)
    setToday(t)
    setWeekLogs(week)
    setStreaks(streak)
  }

  async function toggleMeal(field: 'pre_workout_meal' | 'post_workout_meal') {
    const current = today
    const nextValue = !(current?.[field] === 1)
    await upsertNutritionLog({
      calories: current?.calories ?? null,
      protein_g: current?.protein_g ?? null,
      water_ml: current?.water_ml ?? null,
      pre_workout_meal: field === 'pre_workout_meal' ? nextValue : current?.pre_workout_meal === 1,
      post_workout_meal: field === 'post_workout_meal' ? nextValue : current?.post_workout_meal === 1,
      notes: current?.notes ?? null,
    })
    loadData()
  }

  const calGoal = goals?.calorie_goal ?? 2400
  const proteinGoal = goals?.protein_goal ?? 160
  const waterGoal = goals?.water_goal_ml ?? 3000

  const dayMap = new Map(weekLogs.map((l) => [l.date, l]))
  const todayStr = new Date().toISOString().slice(0, 10)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d
  })
  const barData = days.map((d) => {
    const dateStr = d.toISOString().slice(0, 10)
    const log = dayMap.get(dateStr)
    return {
      label: DAY_LABELS[d.getDay()],
      value: log?.calories ?? 0,
      highlight: dateStr === todayStr,
    }
  })

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nutrition</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/nutrition/log')}>
          <Text style={styles.headerBtnText}>Log Today</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.ringsCard}>
          <ProgressRing
            value={today?.protein_g ?? 0}
            goal={proteinGoal}
            size={76}
            color={colors.accentMid}
            label="Protein"
          />
          <ProgressRing
            value={today?.calories ?? 0}
            goal={calGoal}
            size={104}
            color={colors.accentDark}
            label="Calories"
          />
          <ProgressRing
            value={today?.water_ml ?? 0}
            goal={waterGoal}
            size={76}
            color="#3d6fb0"
            label="Water"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Calories</Text>
          <BarChart data={barData} goalLine={calGoal} height={100} />
        </View>

        <View style={styles.streakRow}>
          <View style={[styles.streakChip, streaks.surplusStreak > 0 && styles.streakChipActive]}>
            <Text style={styles.streakValue}>{streaks.surplusStreak}</Text>
            <Text style={styles.streakLabel}>Surplus Streak (days)</Text>
          </View>
          <View style={[styles.streakChip, streaks.deficitStreak > 0 && styles.streakChipActive]}>
            <Text style={styles.streakValue}>{streaks.deficitStreak}</Text>
            <Text style={styles.streakLabel}>Deficit Streak (days)</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Meal Timing</Text>
          <ToggleRow
            label="Pre-workout meal"
            value={today?.pre_workout_meal === 1}
            onToggle={() => toggleMeal('pre_workout_meal')}
          />
          <ToggleRow
            label="Post-workout meal"
            value={today?.post_workout_meal === 1}
            onToggle={() => toggleMeal('post_workout_meal')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function ToggleRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.togglePill, value && styles.togglePillOn]}
        onPress={onToggle}
        activeOpacity={0.85}
      >
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </TouchableOpacity>
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
  ringsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: sp.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
    marginBottom: sp.md,
  },
  cardTitle: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: sp.md },
  streakRow: { flexDirection: 'row', gap: sp.sm, marginBottom: sp.md },
  streakChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
    alignItems: 'center',
  },
  streakChipActive: { borderColor: colors.accentMid, borderWidth: 1.5 },
  streakValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.xl },
  streakLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: 4, textAlign: 'center' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  toggleLabel: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.sm },
  togglePill: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surfaceInput,
    padding: 3,
    justifyContent: 'center',
  },
  togglePillOn: { backgroundColor: colors.accentMid },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleKnobOn: { alignSelf: 'flex-end' },
})
