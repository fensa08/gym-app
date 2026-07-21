import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { upsertNutritionLog, getTodayNutritionLog, getUserGoals } from '../../lib/firestore/queriesHealth'

export default function LogNutritionModal() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [water, setWater] = useState('')
  const [preWorkout, setPreWorkout] = useState(false)
  const [postWorkout, setPostWorkout] = useState(false)
  const [goals, setGoals] = useState({ protein_goal: 160, carbs_goal: 250, fat_goal: 75 })
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    ;(async () => {
      const [today, g] = await Promise.all([getTodayNutritionLog(), getUserGoals()])
      setGoals({ protein_goal: g.protein_goal, carbs_goal: g.carbs_goal, fat_goal: g.fat_goal })
      if (today) {
        if (today.calories != null) setCalories(String(today.calories))
        if (today.protein_g != null) setProtein(String(today.protein_g))
        if (today.carbs_g != null) setCarbs(String(today.carbs_g))
        if (today.fat_g != null) setFat(String(today.fat_g))
        if (today.water_ml != null) setWater(String(today.water_ml))
        setPreWorkout(today.pre_workout_meal === 1)
        setPostWorkout(today.post_workout_meal === 1)
        if (today.notes) setNotes(today.notes)
      }
    })()
  }, [])

  async function handleSave() {
    await upsertNutritionLog({
      calories: calories ? parseInt(calories, 10) : null,
      protein_g: protein ? parseFloat(protein) : null,
      carbs_g: carbs ? parseFloat(carbs) : null,
      fat_g: fat ? parseFloat(fat) : null,
      water_ml: water ? parseInt(water, 10) : null,
      pre_workout_meal: preWorkout,
      post_workout_meal: postWorkout,
      notes: notes.trim() || null,
    })
    router.back()
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + sp.md, maxHeight: '90%' }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Log Today</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
          <Text style={styles.fieldLabel}>Calories</Text>
          <TextInput
            style={styles.bigInput}
            value={calories}
            onChangeText={setCalories}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
          />

          <View style={styles.labelRow}>
            <Text style={styles.fieldLabel}>Protein (g)</Text>
            <Text style={styles.goalRef}>Goal: {goals.protein_goal}g</Text>
          </View>
          <TextInput
            style={styles.input}
            value={protein}
            onChangeText={setProtein}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
          />

          <View style={[styles.macroRow, { marginTop: sp.md }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Carbs (g)</Text>
                <Text style={styles.goalRef}>{goals.carbs_goal}g</Text>
              </View>
              <TextInput
                style={styles.input}
                value={carbs}
                onChangeText={setCarbs}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Fat (g)</Text>
                <Text style={styles.goalRef}>{goals.fat_goal}g</Text>
              </View>
              <TextInput
                style={styles.input}
                value={fat}
                onChangeText={setFat}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={[styles.fieldLabel, { marginTop: sp.md }]}>Water (ml)</Text>
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

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.88}>
          <Text style={styles.saveBtnText}>Save</Text>
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
  fieldLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginBottom: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  goalRef: { color: colors.textMuted, fontFamily: fonts.mono, fontSize: fs.xs },
  bigInput: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontFamily: fonts.monoBold,
    fontSize: 36,
    marginBottom: sp.md,
  },
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
  macroRow: { flexDirection: 'row', gap: sp.sm },
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
