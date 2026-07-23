import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { getFoods, deleteFood } from '../../lib/firestore/queriesHealth'
import type { Food } from '../../lib/types'

export default function FoodsLibraryScreen() {
  const router = useRouter()
  const [foods, setFoods] = useState<Food[]>([])
  const [search, setSearch] = useState('')

  useFocusEffect(
    useCallback(() => {
      getFoods().then(setFoods)
    }, [])
  )

  async function handleDelete(id: string) {
    await deleteFood(id)
    setFoods(prev => prev.filter(f => f.id !== id))
  }

  const filtered = foods.filter(f => f.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Food Library</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/nutrition/food-edit')}>
          <Ionicons name="add" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search foods…"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 && (
          <Text style={styles.empty}>
            {foods.length === 0 ? 'No foods yet. Add one to get started.' : 'No matches.'}
          </Text>
        )}
        {filtered.map(food => (
          <View key={food.id} style={styles.card}>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/nutrition/food-edit', params: { id: food.id } })}
            >
              <Text style={styles.foodName}>{food.name}</Text>
              <Text style={styles.foodMacros}>
                {food.calories_per_100g} kcal · P{food.protein_per_100g}g · C{food.carbs_per_100g}g · F{food.fat_per_100g}g
                <Text style={styles.foodMacrosUnit}> / 100g</Text>
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(food.id)}>
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
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
  headerBtn: {
    width: 34, height: 34, borderRadius: r.full, backgroundColor: colors.accentLime,
    alignItems: 'center', justifyContent: 'center',
  },
  searchWrap: { paddingHorizontal: sp.md, marginBottom: sp.sm },
  searchInput: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderMed,
    borderRadius: r.md, paddingHorizontal: sp.md, paddingVertical: 10,
    color: colors.textPrimary, fontFamily: fonts.sans, fontSize: fs.sm,
  },
  content: { padding: sp.md, paddingTop: 0, paddingBottom: 120 },
  empty: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.sm, textAlign: 'center', marginTop: sp.xl },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: r.lg, padding: sp.md, marginBottom: sp.sm,
  },
  foodName: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm, marginBottom: 4 },
  foodMacros: { color: colors.textSecondary, fontFamily: fonts.mono, fontSize: fs.xs },
  foodMacrosUnit: { color: colors.textMuted },
  deleteBtn: { padding: 8 },
})
