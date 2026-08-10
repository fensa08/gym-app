import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Keyboard } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback, useMemo, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { ProgressRing } from '../../components/Ring'
import { BarChart } from '../../components/Charts'
import {
  getNutritionLog,
  getUserGoals,
  getNutritionLogs,
  getNutritionAverages,
  getMaintenanceCalibration,
  upsertNutritionLog,
  getLatestBodyWeight,
  getFoods,
  addFoodToMeal,
  addQuickItem,
  removeMealItem,
  updateMealItemGrams,
} from '../../lib/firestore/queriesHealth'
import type { NutritionLog, UserGoals, Food } from '../../lib/types'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MEAL_ORDER = ['Breakfast', 'Lunch', 'Snack', 'Dinner']

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function mealForNow(): string {
  const h = new Date().getHours()
  if (h >= 5 && h < 11) return 'Breakfast'
  if (h >= 11 && h < 15) return 'Lunch'
  if (h >= 17 && h < 21) return 'Dinner'
  return 'Snack'
}

// "chicken 180" → { text: "chicken", grams: 180 } · "450" → { kcal: 450 }
function parseQuery(raw: string): { text: string; grams: number | null; kcal: number | null } {
  const q = raw.trim()
  if (/^\d+(\.\d+)?$/.test(q)) return { text: '', grams: null, kcal: Math.round(parseFloat(q)) }
  const m = q.match(/^(.*\S)\s+(\d+(?:\.\d+)?)$/)
  if (m) return { text: m[1].toLowerCase(), grams: parseFloat(m[2]), kcal: null }
  return { text: q.toLowerCase(), grams: null, kcal: null }
}

export default function NutritionScreen() {
  const router = useRouter()
  const searchRef = useRef<TextInput>(null)

  const [selectedDate, setSelectedDate] = useState(iso(new Date()))
  const [log, setLog] = useState<NutritionLog | null>(null)
  const [goals, setGoals] = useState<UserGoals | null>(null)
  const [foods, setFoods] = useState<Food[]>([])
  const [weekLogs, setWeekLogs] = useState<NutritionLog[]>([])
  const [averages, setAverages] = useState<{
    avgCalories: number | null; avgProtein: number | null
    avgCarbs: number | null; avgFat: number | null; daysLogged: number
  } | null>(null)
  const [calibration, setCalibration] = useState<{
    avgIntake: number; weightChangePerWeek: number; daysLogged: number
  } | null>(null)
  const [latestWeightKg, setLatestWeightKg] = useState<number | null>(null)

  const [query, setQuery] = useState('')
  const [meal, setMeal] = useState(mealForNow())
  const [searchFocused, setSearchFocused] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [editing, setEditing] = useState<{ mealId: string; itemId: string } | null>(null)
  const [editGrams, setEditGrams] = useState('')

  useFocusEffect(
    useCallback(() => {
      loadData(selectedDate)
    }, [selectedDate])
  )

  async function loadData(date: string) {
    const [g, l, f, week, avgs, cal, w] = await Promise.all([
      getUserGoals(),
      getNutritionLog(date),
      getFoods(),
      getNutritionLogs(7),
      getNutritionAverages(7),
      getMaintenanceCalibration(),
      getLatestBodyWeight(),
    ])
    setGoals(g)
    setLog(l)
    setFoods(f)
    setWeekLogs(week)
    setAverages(avgs)
    setCalibration(cal)
    setLatestWeightKg(w?.weight_kg ?? null)
  }

  function showFlash(message: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash(message)
    flashTimer.current = setTimeout(() => setFlash(null), 2200)
  }

  // ── Search & logging ─────────────────────────────────────────────

  const parsed = useMemo(() => parseQuery(query), [query])

  const suggestions = useMemo(() => {
    if (parsed.kcal != null) return []
    if (!parsed.text) {
      // recents first: frequency, then recency, then the rest of the library
      return [...foods]
        .sort((a, b) =>
          (b.use_count ?? 0) - (a.use_count ?? 0) ||
          (b.last_used_at ?? 0) - (a.last_used_at ?? 0) ||
          a.name.localeCompare(b.name)
        )
        .slice(0, 8)
    }
    return foods.filter(f => f.name.toLowerCase().includes(parsed.text)).slice(0, 8)
  }, [foods, parsed])

  const showPanel = searchFocused || query.trim().length > 0

  async function logFood(food: Food) {
    const grams = parsed.grams ?? food.last_grams ?? 100
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await addFoodToMeal(meal, food, grams, selectedDate)
    setQuery('')
    showFlash(`✓ ${food.name} · ${grams}g → ${meal}`)
    loadData(selectedDate)
  }

  async function logQuickKcal(kcal: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await addQuickItem(meal, { calories: kcal }, selectedDate)
    setQuery('')
    showFlash(`✓ ${kcal} kcal → ${meal}`)
    loadData(selectedDate)
  }

  // ── Item editing ────────────────────────────────────────────────

  function toggleEdit(mealId: string, itemId: string, grams: number) {
    if (editing?.itemId === itemId) {
      setEditing(null)
      return
    }
    setEditing({ mealId, itemId })
    setEditGrams(String(grams))
  }

  async function applyGrams(next: number) {
    if (!editing || next <= 0) return
    setEditGrams(String(next))
    await updateMealItemGrams(selectedDate, editing.mealId, editing.itemId, next)
    loadData(selectedDate)
  }

  async function deleteItem() {
    if (!editing) return
    await removeMealItem(selectedDate, editing.mealId, editing.itemId)
    setEditing(null)
    loadData(selectedDate)
  }

  async function addWater(ml: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await upsertNutritionLog({ water_ml: (log?.water_ml ?? 0) + ml }, selectedDate)
    loadData(selectedDate)
  }

  // ── Derived ─────────────────────────────────────────────────────

  const calGoal = goals?.calorie_goal ?? 2400
  const proteinGoal = goals?.protein_goal ?? 160
  const carbsGoal = goals?.carbs_goal ?? 250
  const fatGoal = goals?.fat_goal ?? 75
  const waterGoal = goals?.water_goal_ml ?? 3000

  const todayStr = iso(new Date())
  const isToday = selectedDate === todayStr
  const dayMap = new Map(weekLogs.map((l) => [l.date, l]))
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d
  })
  const barData = weekDays.map((d) => {
    const dateStr = iso(d)
    const l = dayMap.get(dateStr)
    return { label: DAY_LABELS[d.getDay()], value: l?.calories ?? 0, highlight: dateStr === todayStr }
  })

  const sortedMeals = [...(log?.meals ?? [])].sort((a, b) => {
    const ai = MEAL_ORDER.indexOf(a.name)
    const bi = MEAL_ORDER.indexOf(b.name)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  const dayCal = log?.calories ?? 0
  const proteinCal = (log?.protein_g ?? 0) * 4
  const carbsCal = (log?.carbs_g ?? 0) * 4
  const fatCal = (log?.fat_g ?? 0) * 9
  const splitBase = proteinCal + carbsCal + fatCal || 1
  const proteinPct = Math.round((proteinCal / splitBase) * 100)
  const carbsPct = Math.round((carbsCal / splitBase) * 100)
  const fatPct = 100 - proteinPct - carbsPct

  const proteinPerKg =
    log?.protein_g != null && latestWeightKg != null
      ? (log.protein_g / latestWeightKg).toFixed(2)
      : null

  const estimatedTDEE =
    calibration != null
      ? Math.round(calibration.avgIntake - calibration.weightChangePerWeek * 7700 / 7)
      : null

  const selectedLabel = isToday
    ? 'Today'
    : new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Nutrition</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/nutrition/scan')}>
            <Ionicons name="barcode-outline" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/nutrition/foods')}>
            <Ionicons name="library-outline" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addCta} onPress={() => searchRef.current?.focus()}>
            <Ionicons name="add" size={18} color={colors.textPrimary} />
            <Text style={styles.addCtaText}>Add food</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Smart search bar: the single logging entry point ── */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            ref={searchRef}
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            onFocus={() => {
              if (blurTimer.current) clearTimeout(blurTimer.current)
              setSearchFocused(true)
            }}
            onBlur={() => {
              // delay so a tap on a panel row (recent food, meal chip) can register
              // before the panel unmounts — TextInput blur otherwise wins the race
              blurTimer.current = setTimeout(() => setSearchFocused(false), 150)
            }}
            placeholder="Log food… (e.g. chicken 180, or 450 for kcal)"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {flash && !showPanel && <Text style={styles.flashText}>{flash}</Text>}

        {showPanel && (
          <View style={styles.panel}>
            <View style={styles.mealChipRow}>
              {MEAL_ORDER.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.mealChip, meal === m && styles.mealChipActive]}
                  onPress={() => setMeal(m)}
                >
                  <Text style={[styles.mealChipText, meal === m && styles.mealChipTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {parsed.kcal != null ? (
              <TouchableOpacity style={styles.resultRow} onPress={() => logQuickKcal(parsed.kcal!)}>
                <Text style={styles.resultName}>⚡ Quick add {parsed.kcal} kcal</Text>
                <Text style={styles.resultMacro}>→ {meal}</Text>
              </TouchableOpacity>
            ) : (
              <>
                {!parsed.text && suggestions.length > 0 && (
                  <Text style={styles.panelHint}>Recent — tap to log</Text>
                )}
                {suggestions.map(f => {
                  const grams = parsed.grams ?? f.last_grams ?? 100
                  const kcal = Math.round((f.calories_per_100g * grams) / 100)
                  return (
                    <TouchableOpacity key={f.id} style={styles.resultRow} onPress={() => logFood(f)}>
                      <Text style={styles.resultName} numberOfLines={1}>{f.name}</Text>
                      <Text style={styles.resultMacro}>{grams}g · {kcal} kcal</Text>
                    </TouchableOpacity>
                  )
                })}
                {parsed.text.length > 0 && suggestions.length === 0 && (
                  <TouchableOpacity
                    style={styles.resultRow}
                    onPress={() => {
                      Keyboard.dismiss()
                      router.push({ pathname: '/nutrition/food-edit', params: { name: query.trim() } })
                    }}
                  >
                    <Text style={styles.createLink}>+ Create "{query.trim()}"</Text>
                  </TouchableOpacity>
                )}
                {foods.length === 0 && !parsed.text && (
                  <TouchableOpacity
                    style={styles.resultRow}
                    onPress={() => { Keyboard.dismiss(); router.push('/nutrition/food-edit') }}
                  >
                    <Text style={styles.createLink}>+ Add your first food</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Week strip ── */}
        <View style={styles.weekStrip}>
          {weekDays.map(d => {
            const dateStr = iso(d)
            const l = dayMap.get(dateStr)
            const logged = (l?.calories ?? 0) > 0
            const onTarget = logged && Math.abs((l!.calories ?? 0) - calGoal) <= calGoal * 0.1
            const selected = dateStr === selectedDate
            return (
              <TouchableOpacity
                key={dateStr}
                style={styles.weekDayBtn}
                onPress={() => setSelectedDate(dateStr)}
              >
                <View style={[
                  styles.weekDot,
                  logged && (onTarget ? styles.weekDotOnTarget : styles.weekDotLogged),
                  selected && styles.weekDotSelected,
                ]} />
                <Text style={[styles.weekDayLabel, selected && styles.weekDayLabelSelected]}>
                  {DAY_LABELS[d.getDay()]}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {!isToday && (
          <TouchableOpacity style={styles.dateBanner} onPress={() => setSelectedDate(todayStr)}>
            <Text style={styles.dateBannerText}>{selectedLabel}</Text>
            <Text style={styles.dateBannerLink}>Back to today</Text>
          </TouchableOpacity>
        )}

        {/* ── Rings + water ── */}
        <View style={styles.ringsCard}>
          <View style={styles.ringsRow}>
            <ProgressRing value={log?.protein_g ?? 0} goal={proteinGoal} size={72} color={colors.accentMid} label="Protein" />
            <ProgressRing value={dayCal} goal={calGoal} size={100} color={colors.accentDark} label="Calories" />
            <ProgressRing value={log?.water_ml ?? 0} goal={waterGoal} size={72} color="#3d6fb0" label="Water" />
          </View>
          <View style={styles.waterRow}>
            <TouchableOpacity style={styles.waterChip} onPress={() => addWater(250)}>
              <Text style={styles.waterChipText}>+250ml</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.waterChip} onPress={() => addWater(500)}>
              <Text style={styles.waterChipText}>+500ml</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Meals ── */}
        {sortedMeals.length === 0 ? (
          <TouchableOpacity style={styles.emptyCard} onPress={() => searchRef.current?.focus()}>
            <Text style={styles.emptyTitle}>Nothing logged yet</Text>
            <Text style={styles.emptyText}>Tap here and pick a recent food — one tap logs it.</Text>
          </TouchableOpacity>
        ) : (
          sortedMeals.map(meal => {
            const totalCal = meal.items.reduce((s, it) => s + it.calories, 0)
            const totalProtein = meal.items.reduce((s, it) => s + it.protein_g, 0)
            return (
              <View key={meal.id} style={styles.mealCard}>
                <View style={styles.mealHeaderRow}>
                  <Text style={styles.mealName}>{meal.name}</Text>
                  <Text style={styles.mealTotal}>{totalCal} kcal · P{Math.round(totalProtein)}g</Text>
                </View>
                {meal.items.map(item => {
                  const isEditing = editing?.itemId === item.id
                  return (
                    <View key={item.id}>
                      <TouchableOpacity
                        style={styles.itemRow}
                        onPress={() => toggleEdit(meal.id, item.id, item.grams)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.food_name}{item.grams > 0 ? ` · ${item.grams}g` : ''}
                        </Text>
                        <Text style={styles.itemMacro}>
                          {item.calories} kcal · P{item.protein_g}g
                        </Text>
                      </TouchableOpacity>
                      {isEditing && (
                        <View style={styles.editRow}>
                          {item.grams > 0 ? (
                            <>
                              <TouchableOpacity style={styles.editStep} onPress={() => applyGrams(Math.max(5, item.grams - 25))}>
                                <Text style={styles.editStepText}>−25</Text>
                              </TouchableOpacity>
                              <TextInput
                                style={styles.editInput}
                                value={editGrams}
                                onChangeText={setEditGrams}
                                onSubmitEditing={() => {
                                  const g = parseFloat(editGrams)
                                  if (g > 0) applyGrams(g)
                                }}
                                keyboardType="number-pad"
                                returnKeyType="done"
                              />
                              <Text style={styles.editUnit}>g</Text>
                              <TouchableOpacity style={styles.editStep} onPress={() => applyGrams(item.grams + 25)}>
                                <Text style={styles.editStepText}>+25</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <Text style={styles.editQuickNote}>Quick add — delete and re-log to change</Text>
                          )}
                          <TouchableOpacity style={styles.editDelete} onPress={deleteItem}>
                            <Ionicons name="trash-outline" size={16} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>
            )
          })
        )}

        {/* ── Macro breakdown ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Macros</Text>
          <MacroBar label="Protein" value={log?.protein_g ?? 0} goal={proteinGoal} color={colors.accentMid} unit="g" />
          <MacroBar label="Carbs" value={log?.carbs_g ?? 0} goal={carbsGoal} color="#c98a2e" unit="g" />
          <MacroBar label="Fat" value={log?.fat_g ?? 0} goal={fatGoal} color="#3d6fb0" unit="g" />

          {(proteinCal + carbsCal + fatCal) > 0 && (
            <View style={styles.splitSection}>
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

        {/* ── Week ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>This Week</Text>
          <BarChart data={barData} goalLine={calGoal} height={100} />
          {averages && averages.daysLogged > 0 && (
            <View style={styles.avgGrid}>
              <AvgCell label="Avg Calories" value={averages.avgCalories} goal={calGoal} unit="kcal" />
              <AvgCell label="Avg Protein" value={averages.avgProtein} goal={proteinGoal} unit="g" />
              <AvgCell label="Avg Carbs" value={averages.avgCarbs} goal={carbsGoal} unit="g" />
              <AvgCell label="Avg Fat" value={averages.avgFat} goal={fatGoal} unit="g" />
            </View>
          )}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: sp.md, paddingTop: sp.sm, paddingBottom: sp.sm,
  },
  headerTitle: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 22 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  addCta: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    height: 36, paddingHorizontal: 12, borderRadius: 18,
    backgroundColor: colors.accentDark, borderWidth: 1, borderColor: colors.accentDark,
  },
  addCtaText: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.xs },

  searchWrap: { paddingHorizontal: sp.md, paddingBottom: sp.sm, zIndex: 10 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMed,
    borderRadius: r.full, paddingHorizontal: sp.md, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.sm, padding: 0 },
  flashText: { color: colors.accentMid, fontFamily: fonts.sansSemiBold, fontSize: fs.xs, marginTop: 6, marginLeft: sp.sm },
  panel: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMed,
    borderRadius: r.md, marginTop: 6, overflow: 'hidden',
  },
  mealChipRow: {
    flexDirection: 'row', gap: 6,
    paddingHorizontal: sp.sm, paddingTop: sp.sm, paddingBottom: 4,
  },
  mealChip: {
    flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: r.full,
    backgroundColor: colors.surfaceInput, borderWidth: 1, borderColor: colors.border,
  },
  mealChipActive: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
  mealChipText: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: fs.xs },
  mealChipTextActive: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold },
  panelHint: {
    color: colors.textMuted, fontFamily: fonts.sans, fontSize: 10,
    paddingHorizontal: sp.md, paddingTop: 8, paddingBottom: 2,
  },
  resultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8,
    paddingHorizontal: sp.md, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  resultName: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.sm, flexShrink: 1 },
  resultMacro: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: fs.xs },
  createLink: { color: colors.accentMid, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },

  content: { padding: sp.md, paddingTop: 0, paddingBottom: 120 },

  weekStrip: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: sp.sm, paddingVertical: sp.sm, marginBottom: sp.sm,
  },
  weekDayBtn: { alignItems: 'center', gap: 5, paddingHorizontal: 6 },
  weekDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.surfaceInput, borderWidth: 1, borderColor: colors.border },
  weekDotLogged: { backgroundColor: '#c98a2e', borderColor: '#c98a2e' },
  weekDotOnTarget: { backgroundColor: colors.accentMid, borderColor: colors.accentMid },
  weekDotSelected: { transform: [{ scale: 1.35 }], borderColor: colors.textPrimary },
  weekDayLabel: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 10 },
  weekDayLabelSelected: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold },

  dateBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surfaceInput, borderRadius: r.md,
    paddingHorizontal: sp.md, paddingVertical: 8, marginBottom: sp.sm,
  },
  dateBannerText: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.xs },
  dateBannerLink: { color: colors.accentMid, fontFamily: fonts.sansSemiBold, fontSize: fs.xs },

  ringsCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: r.lg, padding: sp.md, marginBottom: sp.md,
  },
  ringsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  waterRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: sp.sm },
  waterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: r.full,
    backgroundColor: colors.surfaceInput, borderWidth: 1, borderColor: colors.border,
  },
  waterChipText: { color: '#3d6fb0', fontFamily: fonts.sansSemiBold, fontSize: fs.xs },

  emptyCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: r.lg, padding: sp.lg, marginBottom: sp.md, alignItems: 'center',
  },
  emptyTitle: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: 4 },
  emptyText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, textAlign: 'center' },

  mealCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: r.lg, padding: sp.md, marginBottom: sp.sm,
  },
  mealHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  mealName: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  mealTotal: { color: colors.textSecondary, fontFamily: fonts.mono, fontSize: fs.xs },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingVertical: 7,
  },
  itemName: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.xs, flexShrink: 1 },
  itemMacro: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 10 },
  editRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceInput, borderRadius: r.md,
    paddingHorizontal: sp.sm, paddingVertical: 8, marginBottom: 6,
  },
  editStep: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: r.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  editStepText: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.xs },
  editInput: {
    flex: 1, textAlign: 'center', color: colors.textPrimary,
    fontFamily: fonts.monoSemiBold, fontSize: fs.sm, paddingVertical: 4,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: r.sm,
  },
  editUnit: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: fs.xs },
  editQuickNote: { flex: 1, color: colors.textMuted, fontFamily: fonts.sans, fontSize: 10 },
  editDelete: { padding: 6 },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: r.lg, padding: sp.md, marginBottom: sp.md,
  },
  cardTitle: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: sp.md },
  splitSection: { marginTop: 4 },
  splitBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, marginBottom: 6 },
  splitSegment: { height: '100%' },
  splitLegend: { flexDirection: 'row', gap: 12 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  infoLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs },
  infoValue: { color: colors.textPrimary, fontFamily: fonts.monoSemiBold, fontSize: fs.sm },
  avgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: '4%', marginTop: sp.md },
  tdeeValue: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 28, marginBottom: 6 },
  tdeeNote: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, lineHeight: 18 },
})
