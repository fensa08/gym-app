import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useState, useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { createFood, updateFood, getFoods } from '../../lib/firestore/queriesHealth'

export default function FoodEditModal() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const isEdit = !!id

  const [name, setName] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')

  useEffect(() => {
    if (!id) return
    getFoods().then(foods => {
      const food = foods.find(f => f.id === id)
      if (!food) return
      setName(food.name)
      setCalories(String(food.calories_per_100g))
      setProtein(String(food.protein_per_100g))
      setCarbs(String(food.carbs_per_100g))
      setFat(String(food.fat_per_100g))
    })
  }, [id])

  const canSave = name.trim().length > 0 && calories.trim().length > 0

  async function handleSave() {
    if (!canSave) return
    const input = {
      name: name.trim(),
      calories_per_100g: parseFloat(calories) || 0,
      protein_per_100g: parseFloat(protein) || 0,
      carbs_per_100g: parseFloat(carbs) || 0,
      fat_per_100g: parseFloat(fat) || 0,
    }
    if (isEdit && id) {
      await updateFood(id, input)
    } else {
      await createFood(input)
    }
    router.back()
  }

  return (
    <View style={styles.overlay}>
      <View style={[styles.sheet, { paddingBottom: insets.bottom + sp.md }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>{isEdit ? 'Edit Food' : 'New Food'}</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Chicken breast"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={[styles.fieldLabel, { marginTop: sp.md }]}>Calories (per 100g)</Text>
          <TextInput
            style={styles.input}
            value={calories}
            onChangeText={setCalories}
            placeholder="0"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
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
          </View>
          <Text style={styles.hint}>All values are per 100g of this food.</Text>
        </ScrollView>

        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          activeOpacity={0.88}
          disabled={!canSave}
        >
          <Text style={styles.saveBtnText}>{isEdit ? 'Save Changes' : 'Add Food'}</Text>
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
