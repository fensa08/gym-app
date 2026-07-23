import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useEffect, useMemo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import {
  upsertNutritionLog, getTodayNutritionLog, getUserGoals,
  getFoods, addFoodToMeal, removeMealItem,
} from '../../lib/firestore/queriesHealth'
import type { Food, Meal } from '../../lib/types'

const MEAL_CHIPS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']

export default function LogNutritionModal() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [foods, setFoods] = useState<Food[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [mealName, setMealName] = useState('Breakfast')
  const [foodSearch, setFoodSearch] = useState('')
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [grams, setGrams] = useState('')

  const [water, setWater] = useState('')
  const [preWorkout, setPreWorkout] = useState(false)
  const [postWorkout, setPostWorkout] = useState(false)
  const [goals, setGoals] = useState({ protein_goal: 160, carbs_goal: 250, fat_goal: 75 })
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    reload()
  }, [])

  async function reload() {
    const [t, g, f] = await Promise.all([getTodayNutritionLog(), getUserGoals(), getFoods()])
    setGoals({ protein_goal: g.protein_goal, carbs_goal: g.carbs_goal, fat_goal: g.fat_goal })
    setFoods(f)
    if (t) {
      setMeals(t.meals ?? [])
      if (t.water_ml != null) setWater(String(t.water_ml))
      setPreWorkout(t.pre_workout_meal === 1)
      setPostWorkout(t.post_workout_meal === 1)
      if (t.notes) setNotes(t.notes)
    }
  }

  const filteredFoods = useMemo(() => {
    const q = foodSearch.trim().toLowerCase()
    if (!q) return foods.slice(0, 8)
    return foods.filter(f => f.name.toLowerCase().includes(q)).slice(0, 8)
  }, [foods, foodSearch])

  const preview = useMemo(() => {
    const g = parseFloat(grams)
    if (!selectedFood || !g || g <= 0) return null
    return {
      calories: Math.round((selectedFood.calories_per_100g * g) / 100),
      protein_g: Math.round(((selectedFood.protein_per_100g * g) / 100) * 10) / 10,
      carbs_g: Math.round(((selectedFood.carbs_per_100g * g) / 100) * 10) / 10,
      fat_g: Math.round(((selectedFood.fat_per_100g * g) / 100) * 10) / 10,
    }
  }, [selectedFood, grams])

  async function handleAddItem() {
    const g = parseFloat(grams)
    if (!selectedFood || !mealName.trim() || !g || g <= 0) return
    await addFoodToMeal(mealName, selectedFood, g)
    setSelectedFood(null)
    setFoodSearch('')
    setGrams('')
    reload()
  }

  async function handleRemoveItem(mealId: string, itemId: string) {
    const today = new Date().toISOString().slice(0, 10)
    await removeMealItem(today, mealId, itemId)
    reload()
  }

  async function handleSaveMeta() {
    await upsertNutritionLog({
      water_ml: water ? parseInt(water, 10) : null,
      pre_workout_meal: preWorkout,
      post_workout_meal: postWorkout,
      notes: notes.trim() || null,
    })
    router.back()
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + sp.md, maxHeight: '92%' }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Log Today</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
          <Text style={styles.sectionTitle}>Add a Food</Text>

          <Text style={styles.fieldLabel}>Meal</Text>
          <View style={styles.chipRow}>
            {MEAL_CHIPS.map(chip => (
              <TouchableOpacity
                key={chip}
                style={[styles.chip, mealName === chip && styles.chipActive]}
                onPress={() => setMealName(chip)}
              >
                <Text style={[styles.chipText, mealName === chip && styles.chipTextActive]}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={mealName}
            onChangeText={setMealName}
            placeholder="Meal name"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={[styles.fieldLabel, { marginTop: sp.md }]}>Food</Text>
          <TextInput
            style={styles.input}
            value={selectedFood ? selectedFood.name : foodSearch}
            onChangeText={text => {
              setSelectedFood(null)
              setFoodSearch(text)
            }}
            placeholder="Search foods…"
            placeholderTextColor={colors.textSecondary}
          />
          {!selectedFood && foodSearch.trim().length > 0 && (
            <View style={styles.resultsList}>
              {filteredFoods.map(f => (
                <TouchableOpacity key={f.id} style={styles.resultRow} onPress={() => { setSelectedFood(f); setFoodSearch('') }}>
                  <Text style={styles.resultName}>{f.name}</Text>
                  <Text style={styles.resultMacro}>{f.calories_per_100g} kcal/100g</Text>
                </TouchableOpacity>
              ))}
              {filteredFoods.length === 0 && (
                <TouchableOpacity style={styles.resultRow} onPress={() => router.push('/nutrition/food-edit')}>
                  <Text style={styles.addFoodLink}>+ Create "{foodSearch.trim()}" as a new food</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {foods.length === 0 && (
            <TouchableOpacity onPress={() => router.push('/nutrition/food-edit')}>
              <Text style={styles.addFoodLink}>+ Add your first food to the library</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.fieldLabel, { marginTop: sp.md }]}>Grams</Text>
          <TextInput
            style={styles.input}
            value={grams}
            onChangeText={setGrams}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
          />

          {preview && (
            <View style={styles.previewRow}>
              <Text style={styles.previewText}>
                {preview.calories} kcal · P{preview.protein_g}g · C{preview.carbs_g}g · F{preview.fat_g}g
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.addBtn, !preview && styles.addBtnDisabled]}
            onPress={handleAddItem}
            disabled={!preview}
          >
            <Text style={styles.addBtnText}>Add to Meal</Text>
          </TouchableOpacity>

          {meals.length > 0 && (
            <View style={{ marginTop: sp.lg }}>
              <Text style={styles.sectionTitle}>Today's Meals</Text>
              {meals.map(meal => {
                const totalCal = meal.items.reduce((s, it) => s + it.calories, 0)
                return (
                  <View key={meal.id} style={styles.mealCard}>
                    <View style={styles.mealHeaderRow}>
                      <Text style={styles.mealName}>{meal.name}</Text>
                      <Text style={styles.mealTotal}>{totalCal} kcal</Text>
                    </View>
                    {meal.items.map(item => (
                      <View key={item.id} style={styles.itemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>{item.food_name} · {item.grams}g</Text>
                          <Text style={styles.itemMacro}>
                            {item.calories} kcal · P{item.protein_g}g · C{item.carbs_g}g · F{item.fat_g}g
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => handleRemoveItem(meal.id, item.id)}>
                          <Text style={styles.removeText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )
              })}
            </View>
          )}

          <Text style={[styles.sectionTitle, { marginTop: sp.lg }]}>Water & Notes</Text>
          <Text style={styles.fieldLabel}>Water (ml)</Text>
          <TextInput
            style={styles.input}
            value={water}
            onChangeText={setWater}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
          />

          <View style={[styles.card, { marginTop: sp.md }]}>
            <ToggleRow label="Pre-workout meal" value={preWorkout} onToggle={() => setPreWorkout((v) => !v)} />
            <ToggleRow label="Post-workout meal" value={postWorkout} onToggle={() => setPostWorkout((v) => !v)} />
          </View>

          {notesOpen ? (
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add a note…"
              placeholderTextColor={colors.textSecondary}
              multiline
            />
          ) : (
            <TouchableOpacity onPress={() => setNotesOpen(true)}>
              <Text style={styles.notesLink}>+ Add notes</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveMeta} activeOpacity={0.88}>
          <Text style={styles.saveBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: r.xl,
    borderTopRightRadius: r.xl,
    padding: sp.md,
    alignItems: 'center',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderMed, marginBottom: sp.md },
  title: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 24, marginBottom: sp.md },
  sectionTitle: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: sp.sm },
  fieldLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: sp.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: r.full,
    backgroundColor: colors.surfaceInput, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accentLime, borderColor: colors.accentLime },
  chipText: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: fs.xs },
  chipTextActive: { color: colors.textPrimary },
  input: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontFamily: fonts.monoSemiBold,
    fontSize: fs.lg,
  },
  resultsList: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMed,
    borderRadius: r.md, marginTop: 6, overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: sp.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  resultName: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.sm },
  resultMacro: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: fs.xs },
  addFoodLink: { color: colors.accentMid, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginTop: sp.sm },
  previewRow: { marginTop: sp.sm },
  previewText: { color: colors.textSecondary, fontFamily: fonts.mono, fontSize: fs.xs },
  addBtn: {
    backgroundColor: colors.surfaceInput, borderWidth: 1, borderColor: colors.accentMid,
    borderRadius: r.md, paddingVertical: 12, alignItems: 'center', marginTop: sp.md,
  },
  addBtnDisabled: { opacity: 0.4, borderColor: colors.border },
  addBtnText: { color: colors.accentMid, fontFamily: fonts.sansBold, fontSize: fs.sm },
  mealCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: r.lg, padding: sp.md, marginBottom: sp.sm,
  },
  mealHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: sp.sm },
  mealName: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  mealTotal: { color: colors.textSecondary, fontFamily: fonts.mono, fontSize: fs.xs },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6,
  },
  itemName: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.xs },
  itemMacro: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: 10, marginTop: 2 },
  removeText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.sm, paddingHorizontal: 8 },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
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
  notesLink: { color: colors.accentMid, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginTop: sp.md, alignSelf: 'flex-start' },
  notesInput: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.md,
    padding: sp.md,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: fs.sm,
    minHeight: 60,
    marginTop: sp.md,
  },
  saveBtn: {
    backgroundColor: colors.accentLime,
    borderRadius: r.lg,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: sp.md,
  },
  saveBtnText: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: fs.lg },
})
