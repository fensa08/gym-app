import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { getUserGoals, updateUserGoals } from '../../lib/firestore/queriesHealth'

export default function GoalsEditModal() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getUserGoals().then((g) => {
      setCalories(String(g.calorie_goal))
      setProtein(String(g.protein_goal))
      setCarbs(String(g.carbs_goal))
      setFat(String(g.fat_goal))
      setFiber(String(g.fiber_goal))
      setLoaded(true)
    })
  }, [])

  const canSave = loaded && calories.trim().length > 0

  async function handleSave() {
    if (!canSave) return
    await updateUserGoals({
      calorie_goal: parseInt(calories, 10) || 0,
      protein_goal: parseFloat(protein) || 0,
      carbs_goal: parseFloat(carbs) || 0,
      fat_goal: parseFloat(fat) || 0,
      fiber_goal: parseFloat(fiber) || 0,
    })
    router.back()
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + sp.md }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Nutrition Goals</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
          <Text style={styles.fieldLabel}>Daily Calories (kcal)</Text>
          <TextInput
            style={styles.input}
            value={calories}
            onChangeText={setCalories}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
          />

          <View style={[styles.macroRow, { marginTop: sp.md }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Protein (g)</Text>
              <TextInput
                style={styles.input}
                value={protein}
                onChangeText={setProtein}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Carbs (g)</Text>
              <TextInput
                style={styles.input}
                value={carbs}
                onChangeText={setCarbs}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={[styles.macroRow, { marginTop: sp.md }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Fat (g)</Text>
              <TextInput
                style={styles.input}
                value={fat}
                onChangeText={setFat}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Fiber (g)</Text>
              <TextInput
                style={styles.input}
                value={fiber}
                onChangeText={setFiber}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <Text style={styles.hint}>These targets drive the rings and bars on the Nutrition tab.</Text>
        </ScrollView>

        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          activeOpacity={0.88}
          disabled={!canSave}
        >
          <Text style={styles.saveBtnText}>Save Goals</Text>
        </TouchableOpacity>
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
    maxHeight: '90%',
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderMed, marginBottom: sp.md },
  title: { color: colors.textPrimary, fontFamily: fonts.serif, fontSize: 24, marginBottom: sp.md },
  fieldLabel: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginBottom: 6 },
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
  macroRow: { flexDirection: 'row', gap: sp.sm },
  hint: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: sp.md },
  saveBtn: {
    backgroundColor: colors.accentLime,
    borderRadius: r.lg,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
    marginTop: sp.md,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: fs.lg },
})
