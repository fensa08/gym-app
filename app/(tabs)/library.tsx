import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  SectionList,
} from 'react-native'
import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, sp, r, fs } from '../../lib/theme'
import { getAllExercises, searchExercises } from '../../lib/db/queries'
import type { Exercise } from '../../lib/types'

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core']

const MUSCLE_COLOR: Record<string, string> = {
  Chest: '#6C63FF',
  Back: '#00D4A4',
  Legs: '#FF6B35',
  Shoulders: '#FFB800',
  Biceps: '#FF4B4B',
  Triceps: '#A78BFA',
  Core: '#34D399',
}

export default function LibraryScreen() {
  const db = useSQLiteContext()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')

  useFocusEffect(
    useCallback(() => {
      load()
    }, [])
  )

  async function load() {
    setExercises(await getAllExercises(db))
  }

  async function handleSearch(text: string) {
    setQuery(text)
    setExercises(
      text.trim()
        ? await searchExercises(db, text)
        : await getAllExercises(db)
    )
  }

  const filtered =
    filter === 'All' ? exercises : exercises.filter((e) => e.muscle_group === filter)

  const sections = Object.entries(
    filtered.reduce<Record<string, Exercise[]>>((acc, ex) => {
      const g = ex.muscle_group
      if (!acc[g]) acc[g] = []
      acc[g].push(ex)
      return acc
    }, {})
  ).map(([title, data]) => ({ title, data }))

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Exercise Library</Text>
        <Text style={styles.count}>{filtered.length} exercises</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleSearch}
          placeholder="Search exercises..."
          placeholderTextColor={colors.textSecondary}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Muscle filter chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={MUSCLE_GROUPS}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.chipList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, filter === item && styles.chipOn]}
            onPress={() => setFilter(item)}
          >
            {item !== 'All' && (
              <View
                style={[
                  styles.chipDot,
                  { backgroundColor: MUSCLE_COLOR[item] ?? colors.accent },
                ]}
              />
            )}
            <Text style={[styles.chipText, filter === item && styles.chipTextOn]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Section list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <View
              style={[
                styles.sectionDot,
                { backgroundColor: MUSCLE_COLOR[section.title] ?? colors.accent },
              ]}
            />
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.exRow}>
            <View style={styles.exInfo}>
              <Text style={styles.exName}>{item.name}</Text>
              <Text style={styles.exEquip}>{item.equipment}</Text>
            </View>
            <Ionicons name="chevron-forward" size={15} color={colors.border} />
          </View>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sp.md,
    paddingTop: sp.sm,
    paddingBottom: sp.xs,
  },
  title: { color: colors.textPrimary, fontSize: fs.xl, fontWeight: '800' },
  count: { color: colors.textSecondary, fontSize: fs.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    backgroundColor: colors.surface,
    marginHorizontal: sp.md,
    marginBottom: sp.sm,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: fs.md },
  chipList: {
    paddingHorizontal: sp.md,
    gap: sp.sm,
    paddingBottom: sp.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: sp.md,
    paddingVertical: 7,
    backgroundColor: colors.surface,
    borderRadius: r.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: {
    backgroundColor: colors.accent + '1A',
    borderColor: colors.accent,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { color: colors.textSecondary, fontSize: fs.sm, fontWeight: '600' },
  chipTextOn: { color: colors.accent },
  listContent: { paddingHorizontal: sp.md, paddingBottom: 100 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    marginTop: sp.lg,
    marginBottom: sp.sm,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fs.md,
    fontWeight: '700',
  },
  sectionCount: { color: colors.textSecondary, fontSize: fs.sm },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: r.md,
    padding: sp.md,
    marginBottom: sp.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exInfo: { flex: 1 },
  exName: { color: colors.textPrimary, fontSize: fs.md, fontWeight: '600' },
  exEquip: { color: colors.textSecondary, fontSize: fs.sm, marginTop: 2 },
})
