import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Keyboard } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useState, useMemo, useEffect, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { getFoods, addFoodToMeal, addQuickItem } from '../../lib/firestore/queriesHealth'
import type { Food } from '../../lib/types'

const MEAL_ORDER = ['Breakfast', 'Lunch', 'Snack', 'Dinner']

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

export default function AddFoodModal() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ date?: string }>()
  const date = params.date

  const inputRef = useRef<TextInput>(null)
  const [foods, setFoods] = useState<Food[]>([])
  const [query, setQuery] = useState('')
  const [meal, setMeal] = useState(mealForNow())
  const [flash, setFlash] = useState<string | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selection, setSelection] = useState<{ type: 'food'; food: Food } | { type: 'kcal' } | null>(null)

  function handleQueryChange(text: string) {
    setQuery(text)
    setSelection(null)
  }

  useEffect(() => {
    getFoods().then(setFoods)
    const t = setTimeout(() => inputRef.current?.focus(), 250)
    return () => clearTimeout(t)
  }, [])

  function showFlash(message: string) {
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash(message)
    flashTimer.current = setTimeout(() => setFlash(null), 2200)
  }

  const parsed = useMemo(() => parseQuery(query), [query])

  const suggestions = useMemo(() => {
    if (parsed.kcal != null) return []
    if (!parsed.text) {
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

  async function confirmAdd() {
    if (!selection) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (selection.type === 'food') {
      const grams = parsed.grams ?? selection.food.last_grams ?? 100
      await addFoodToMeal(meal, selection.food, grams, date)
      showFlash(`✓ ${selection.food.name} · ${grams}g → ${meal}`)
    } else if (parsed.kcal != null) {
      await addQuickItem(meal, { calories: parsed.kcal }, date)
      showFlash(`✓ ${parsed.kcal} kcal → ${meal}`)
    }
    setQuery('')
    setSelection(null)
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + sp.md }]}>
        <View style={styles.handle} />
        <View style={styles.titleRow}>
          <Text style={styles.title}>Add Food</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Log food… (e.g. chicken 180, or 450 for kcal)"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setSelection(null) }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.addBtn, !selection && styles.addBtnDisabled]}
            disabled={!selection}
            onPress={confirmAdd}
          >
            <Text style={[styles.addBtnText, !selection && styles.addBtnTextDisabled]}>Add food</Text>
          </TouchableOpacity>
        </View>

        {flash && <Text style={styles.flashText}>{flash}</Text>}

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

        <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%', flex: 1 }} keyboardShouldPersistTaps="handled">
          {parsed.kcal != null ? (
            <TouchableOpacity
              style={[styles.resultRow, selection?.type === 'kcal' && styles.resultRowSelected]}
              onPress={() => setSelection({ type: 'kcal' })}
            >
              <Text style={styles.resultName}>⚡ Quick add {parsed.kcal} kcal</Text>
              <Text style={styles.resultMacro}>→ {meal}</Text>
            </TouchableOpacity>
          ) : (
            <>
              {!parsed.text && suggestions.length > 0 && (
                <Text style={styles.panelHint}>Recent — tap to select, then Add food</Text>
              )}
              {suggestions.map(f => {
                const grams = parsed.grams ?? f.last_grams ?? 100
                const kcal = Math.round((f.calories_per_100g * grams) / 100)
                const isSelected = selection?.type === 'food' && selection.food.id === f.id
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.resultRow, isSelected && styles.resultRowSelected]}
                    onPress={() => setSelection({ type: 'food', food: f })}
                  >
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
        </ScrollView>
      </View>
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
    height: '85%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderMed, marginBottom: sp.md },
  titleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', marginBottom: sp.md,
  },
  title: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 24 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMed,
    borderRadius: r.full, paddingHorizontal: sp.md, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.sm, padding: 0 },
  flashText: { color: colors.accentMid, fontFamily: fonts.sansSemiBold, fontSize: fs.xs, marginTop: 8, alignSelf: 'flex-start' },

  addBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: r.full,
    backgroundColor: colors.accentLime,
  },
  addBtnDisabled: { backgroundColor: colors.surfaceInput },
  addBtnText: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.xs },
  addBtnTextDisabled: { color: colors.textMuted },

  mealChipRow: { flexDirection: 'row', gap: 6, width: '100%', marginTop: sp.md, marginBottom: sp.sm },
  mealChip: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: r.full,
    backgroundColor: colors.surfaceInput, borderWidth: 1, borderColor: colors.border,
  },
  mealChipActive: { backgroundColor: colors.accentLime, borderColor: colors.accentLime },
  mealChipText: { color: colors.textSecondary, fontFamily: fonts.sansMedium, fontSize: fs.xs },
  mealChipTextActive: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold },

  panelHint: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 10, paddingTop: 4, paddingBottom: 2 },
  resultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  resultRowSelected: {
    backgroundColor: colors.surfaceGreen, borderBottomColor: colors.accentLime,
    marginHorizontal: -sp.md, paddingHorizontal: sp.md, borderRadius: r.md,
  },
  resultName: { color: colors.textPrimary, fontFamily: fonts.sansMedium, fontSize: fs.sm, flexShrink: 1 },
  resultMacro: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: fs.xs },
  createLink: { color: colors.accentMid, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
})
