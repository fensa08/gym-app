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
  getNutritionAverages,
  getMaintenanceCalibration,
  upsertNutritionLog,
  getLatestBodyWeight,
} from '../../lib/firestore/queriesHealth'
import type { NutritionLog, UserGoals } from '../../lib/types'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function NutritionHubScreen() {
  const router = useRouter()
  const [today, setToday] = useState<NutritionLog | null>(null)
  const [goals, setGoals] = useState<UserGoals | null>(null)
  const [weekLogs, setWeekLogs] = useState<NutritionLog[]>([])
  const [streaks, setStreaks] = useState({ surplusStreak: 0, deficitStreak: 0 })
  const [averages, setAverages] = useState<{
    avgCalories: number | null; avgProtein: number | null
    avgCarbs: number | null; avgFat: number | null; daysLogged: number
  } | null>(null)
  const [calibration, setCalibration] = useState<{
    avgIntake: number; weightChangePerWeek: number; daysLogged: number
  } | null>(null)
  const [latestWeightKg, setLatestWeightKg] = useState<number | null>(null)

  useFocusEffect(
    useCallback(() => {
      loadData()
    }, [])
  )

  async function loadData() {
    const g = await getUserGoals()
    const [t, week, streak, avgs, cal, w] = await Promise.all([
      getTodayNutritionLog(),
      getNutritionLogs(7),
      getNutritionStreaks(g.calorie_goal),
      getNutritionAverages(7),
      getMaintenanceCalibration(),
      getLatestBodyWeight(),
    ])
    setGoals(g)
    setToday(t)
    setWeekLogs(week)
    setStreaks(streak)
    setAverages(avgs)
    setCalibration(cal)
    setLatestWeightKg(w?.weight_kg ?? null)
  }

  async function toggleMeal(field: 'pre_workout_meal' | 'post_workout_meal') {
    const current = today
    const nextValue = !(current?.[field] === 1)
    await upsertNutritionLog({
      water_ml: current?.water_ml ?? null,
      pre_workout_meal: field === 'pre_workout_meal' ? nextValue : current?.pre_workout_meal === 1,
      post_workout_meal: field === 'post_workout_meal' ? nextValue : current?.post_workout_meal === 1,
      notes: current?.notes ?? null,
    })
    loadData()
  }

  const calGoal = goals?.calorie_goal ?? 2400
  const proteinGoal = goals?.protein_goal ?? 160
  const carbsGoal = goals?.carbs_goal ?? 250
  const fatGoal = goals?.fat_goal ?? 75
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
    return { label: DAY_LABELS[d.getDay()], value: log?.calories ?? 0, highlight: dateStr === todayStr }
  })

  // Macro split % from today's values
  const todayCal = today?.calories ?? 0
  const proteinCal = (today?.protein_g ?? 0) * 4
  const carbsCal = (today?.carbs_g ?? 0) * 4
  const fatCal = (today?.fat_g ?? 0) * 9
  const splitBase = proteinCal + carbsCal + fatCal || 1
  const proteinPct = Math.round((proteinCal / splitBase) * 100)
  const carbsPct = Math.round((carbsCal / splitBase) * 100)
  const fatPct = 100 - proteinPct - carbsPct

  // Protein per kg body weight
  const proteinPerKg =
    today?.protein_g != null && latestWeightKg != null
      ? (today.protein_g / latestWeightKg).toFixed(2)
      : null

  // Estimated TDEE from calibration
  const estimatedTDEE =
    calibration != null
      ? Math.round(calibration.avgIntake - calibration.weightChangePerWeek * 7700 / 7)
      : null

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

      <TouchableOpacity style={styles.foodsLink} onPress={() => router.push('/nutrition/foods')}>
        <Text style={styles.foodsLinkText}>Manage Food Library</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.accentMid} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Macro rings ── */}
        <View style={styles.ringsCard}>
          <ProgressRing value={today?.protein_g ?? 0} goal={proteinGoal} size={72} color={colors.accentMid} label="Protein" />
          <ProgressRing value={todayCal} goal={calGoal} size={100} color={colors.accentDark} label="Calories" />
          <ProgressRing value={today?.water_ml ?? 0} goal={waterGoal} size={72} color="#3d6fb0" label="Water" />
        </View>

        {/* ── Today's macro breakdown ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Macros</Text>
          <MacroBar label="Protein" value={today?.protein_g ?? 0} goal={proteinGoal} color={colors.accentMid} unit="g" />
          <MacroBar label="Carbs" value={today?.carbs_g ?? 0} goal={carbsGoal} color="#c98a2e" unit="g" />
          <MacroBar label="Fat" value={today?.fat_g ?? 0} goal={fatGoal} color="#3d6fb0" unit="g" />

          {(proteinCal + carbsCal + fatCal) > 0 && (
            <View style={styles.splitSection}>
              <Text style={styles.splitLabel}>Macro Split</Text>
              <View style={styles.splitBar}>
                <View style={[styles.splitSegment, { flex: proteinPct, backgroundColor: colors.accentMid }]} />
                <View style={[styles.splitSegment, { flex: carbsPct, backgroundColor: '#c98a2e' }]} />
                <View style={[styles.splitSegment, { flex: fatPct, backgroundColor: '#3d6fb0' }]} />
              </View>
              <View style={styles.splitLegend}>
                <SplitLegendItem color={colors.accentMid} label={`P ${proteinPct}%`} />
                <SplitLegendItem color="#c98a2e" label={`C ${carbsPct}%`} />
                <SplitLegendItem color="#3d6fb0" label={`F ${fatPct}%`} />
              </View>
            </View>
          )}

          {proteinPerKg && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Protein / kg bodyweight</Text>
              <Text style={styles.infoValue}>{proteinPerKg} g/kg</Text>
            </View>
          )}
        </View>

        {/* ── Today's meals ── */}
        {today && today.meals && today.meals.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Today's Meals</Text>
            {today.meals.map((meal) => {
              const totalCal = meal.items.reduce((s, it) => s + it.calories, 0)
              return (
                <View key={meal.id} style={styles.mealRow}>
                  <View style={styles.mealHeaderRow}>
                    <Text style={styles.mealName}>{meal.name}</Text>
                    <Text style={styles.mealTotal}>{totalCal} kcal</Text>
                  </View>
                  {meal.items.map((item) => (
                    <Text key={item.id} style={styles.mealItemText}>
                      {item.food_name} · {item.grams}g · {item.calories} kcal
                    </Text>
                  ))}
                </View>
              )
            })}
          </View>
        )}

        {/* ── 7-day averages ── */}
        {averages && averages.daysLogged > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>7-Day Averages</Text>
            <View style={styles.avgGrid}>
              <AvgCell label="Calories" value={averages.avgCalories} goal={calGoal} unit="kcal" />
              <AvgCell label="Protein" value={averages.avgProtein} goal={proteinGoal} unit="g" />
              <AvgCell label="Carbs" value={averages.avgCarbs} goal={carbsGoal} unit="g" />
              <AvgCell label="Fat" value={averages.avgFat} goal={fatGoal} unit="g" />
            </View>
            <Text style={styles.avgFootnote}>Based on {averages.daysLogged} logged day{averages.daysLogged !== 1 ? 's' : ''}</Text>
          </View>
        )}

        {/* ── Weekly calorie chart ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Calories</Text>
          <BarChart data={barData} goalLine={calGoal} height={100} />
        </View>

        {/* ── Calorie calibration ── */}
        {estimatedTDEE != null && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Estimated Maintenance</Text>
            <Text style={styles.tdeeValue}>{estimatedTDEE.toLocaleString()} kcal/day</Text>
            <Text style={styles.tdeeNote}>
              Based on {calibration!.daysLogged} days of logs and actual weight change
              ({calibration!.weightChangePerWeek >= 0 ? '+' : ''}{calibration!.weightChangePerWeek.toFixed(2)} kg/wk).
              Set your calorie goal relative to this number.
            </Text>
          </View>
        )}

        {/* ── Streaks ── */}
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

        {/* ── Meal timing ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Meal Timing</Text>
          <ToggleRow label="Pre-workout meal" value={today?.pre_workout_meal === 1} onToggle={() => toggleMeal('pre_workout_meal')} />
          <ToggleRow label="Post-workout meal" value={today?.post_workout_meal === 1} onToggle={() => toggleMeal('post_workout_meal')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function MacroBar({ label, value, goal, color, unit }: { label: string; value: number; goal: number; color: string; unit: string }) {
  const pct = Math.min(1, goal > 0 ? value / goal : 0)
  return (
    <View style={macroStyles.wrap}>
      <View style={macroStyles.row}>
        <Text style={macroStyles.label}>{label}</Text>
        <Text style={macroStyles.value}>{value > 0 ? value.toFixed(0) : '—'}<Text style={macroStyles.unit}> / {goal}{unit}</Text></Text>
      </View>
      <View style={macroStyles.track}>
        <View style={[macroStyles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} />
      </View>
    </View>
  )
}

const macroStyles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  label: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs },
  value: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.xs },
  unit: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: fs.xs },
  track: { height: 5, backgroundColor: colors.surfaceInput, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
})

function AvgCell({ label, value, goal, unit }: { label: string; value: number | null; goal: number; unit: string }) {
  const pct = value != null && goal > 0 ? Math.round((value / goal) * 100) : null
  return (
    <View style={avgStyles.cell}>
      <Text style={avgStyles.label}>{label}</Text>
      <Text style={avgStyles.value}>{value != null ? Math.round(value) : '—'}<Text style={avgStyles.unit}> {unit}</Text></Text>
      {pct != null && <Text style={[avgStyles.pct, pct >= 90 ? avgStyles.pctGood : pct >= 70 ? avgStyles.pctWarn : avgStyles.pctLow]}>{pct}% of goal</Text>}
    </View>
  )
}

const avgStyles = StyleSheet.create({
  cell: { width: '48%', backgroundColor: colors.surfaceInput, borderRadius: r.md, padding: 10, marginBottom: 8 },
  label: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 10, marginBottom: 4 },
  value: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.md },
  unit: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 10 },
  pct: { fontFamily: fonts.sans, fontSize: 10, marginTop: 3 },
  pctGood: { color: colors.accentMid },
  pctWarn: { color: '#c98a2e' },
  pctLow: { color: colors.textMuted },
})

function SplitLegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: colors.textSecondary, fontFamily: fonts.sans, fontSize: 10 }}>{label}</Text>
    </View>
  )
}

function ToggleRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <TouchableOpacity style={[styles.togglePill, value && styles.togglePillOn]} onPress={onToggle} activeOpacity={0.85}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobOn]} />
      </TouchableOpacity>
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
  foodsLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingBottom: sp.sm,
  },
  foodsLinkText: { color: colors.accentMid, fontFamily: fonts.sansSemiBold, fontSize: fs.xs },
  content: { padding: sp.md, paddingTop: 0, paddingBottom: 120 },
  mealRow: { marginBottom: sp.sm, paddingBottom: sp.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  mealHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  mealName: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.xs },
  mealTotal: { color: colors.textSecondary, fontFamily: fonts.mono, fontSize: fs.xs },
  mealItemText: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 10, marginTop: 2 },
  ringsCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: r.lg, padding: sp.md, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-around', marginBottom: sp.md,
  },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: r.lg, padding: sp.md, marginBottom: sp.md,
  },
  cardTitle: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: sp.md },
  splitSection: { marginTop: 4 },
  splitLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginBottom: 6 },
  splitBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, marginBottom: 6 },
  splitSegment: { height: '100%' },
  splitLegend: { flexDirection: 'row', gap: 12 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  infoLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs },
  infoValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.sm },
  avgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: '4%' },
  avgFootnote: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 10, marginTop: 4 },
  tdeeValue: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 28, marginBottom: 6 },
  tdeeNote: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, lineHeight: 18 },
  streakRow: { flexDirection: 'row', gap: sp.sm, marginBottom: sp.md },
  streakChip: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: r.lg, padding: sp.md, alignItems: 'center',
  },
  streakChipActive: { borderColor: colors.accentMid, borderWidth: 1.5 },
  streakValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.xl },
  streakLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: 4, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  toggleLabel: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.sm },
  togglePill: {
    width: 46, height: 26, borderRadius: 13, backgroundColor: colors.surfaceInput, padding: 3, justifyContent: 'center',
  },
  togglePillOn: { backgroundColor: colors.accentMid },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleKnobOn: { alignSelf: 'flex-end' },
})
