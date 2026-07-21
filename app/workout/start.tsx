import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import { TEMPLATES } from '../../lib/templates'
import { buildWorkoutFromTemplate } from '../../lib/workoutHelpers'
import {
  createWorkout,
  getOrCreateExercise,
  addWorkoutExercise,
  getPreviousSets,
  getRecentWorkouts,
  getUserPrograms,
  type UserProgram,
} from '../../lib/firestore/queries'
import { useWorkoutStore } from '../../lib/store/workout'
import type { Workout, ActiveExercise } from '../../lib/types'

// All unique exercise names across built-in templates
const POOL = Array.from(new Set(TEMPLATES.flatMap((t) => t.exercises.map((e) => e.name))))

type ScreenView = 'list' | 'custom'

interface ProgramItem {
  kind: 'template'
  index: number
  name: string
  sub: string
  exercises: number
  duration: number
  iconBg: string
  iconColor: string
}

interface UserProgramItem {
  kind: 'user'
  program: UserProgram
  name: string
  sub: string
  exercises: number
  iconBg: string
  iconColor: string
}

type ListItem = ProgramItem | UserProgramItem

export default function StartWorkoutScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [view, setView] = useState<ScreenView>('list')
  const [loading, setLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [orderedPrograms, setOrderedPrograms] = useState<ListItem[]>([])

  // Custom builder state
  const [workoutName, setWorkoutName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [customInput, setCustomInput] = useState('')
  const [customExercises, setCustomExercises] = useState<string[]>([])
  const [search, setSearch] = useState('')

  const topInset = Math.max(insets.top, 54)
  const bottomInset = Math.max(insets.bottom, sp.md)

  useEffect(() => {
    loadPrograms()
  }, [])

  async function loadPrograms() {
    setDataLoading(true)
    const [recent, userPrograms] = await Promise.all([
      getRecentWorkouts(20),
      getUserPrograms(),
    ])

    // Build full list items for templates
    const templateItems: ProgramItem[] = TEMPLATES.map((t, i) => ({
      kind: 'template',
      index: i,
      name: t.name,
      sub: t.sub,
      exercises: t.exercises.length,
      duration: t.duration,
      iconBg: t.iconBg,
      iconColor: t.iconColor,
    }))

    // Build list items for user programs
    const userItems: UserProgramItem[] = userPrograms.map((p) => ({
      kind: 'user',
      program: p,
      name: p.name,
      sub: `${p.exercises.length} custom exercises`,
      exercises: p.exercises.length,
      iconBg: colors.surface,
      iconColor: colors.textSecondary,
    }))

    const allItems: ListItem[] = [...templateItems, ...userItems]

    // Find last 2 recently used, preserving order (most recent first)
    const recentNames = recent.map((w: Workout) => w.name)
    const seen = new Set<string>()
    const last2: ListItem[] = []
    for (const name of recentNames) {
      if (seen.has(name)) continue
      const match = allItems.find((p) => p.name === name)
      if (match) {
        last2.push(match)
        seen.add(name)
      }
      if (last2.length === 2) break
    }

    const last2Names = new Set(last2.map((p) => p.name))
    const rest = allItems.filter((p) => !last2Names.has(p.name))

    setOrderedPrograms([...last2, ...rest])
    setDataLoading(false)
  }

  async function startTemplate(index: number) {
    setLoading(true)
    try {
      const template = TEMPLATES[index]
      const { workoutId, exercises } = await buildWorkoutFromTemplate(template)
      useWorkoutStore.getState().startWorkout(workoutId, template.name, exercises)
      router.replace('/workout/active')
    } finally {
      setLoading(false)
    }
  }

  async function startUserProgram(program: UserProgram) {
    setLoading(true)
    try {
      const workoutId = await createWorkout(program.name)
      const exercises: ActiveExercise[] = []
      for (let i = 0; i < program.exercises.length; i++) {
        const tmpl = program.exercises[i]
        const ex = await getOrCreateExercise(tmpl.name)
        const workoutExerciseId = await addWorkoutExercise(workoutId, ex.id, i, ex.name)
        const prevSets = await getPreviousSets(ex.id)
        const last = prevSets[0]
        exercises.push({
          workoutExerciseId,
          exerciseId: ex.id,
          name: ex.name,
          muscleGroup: ex.muscle_group,
          equipment: ex.equipment,
          target: `${tmpl.sets} sets × reps`,
          startReps: last?.reps ?? 8,
          startKg: last?.weight_kg ?? 20,
          loggedSets: [],
          previousSets: prevSets,
        })
      }
      useWorkoutStore.getState().startWorkout(workoutId, program.name, exercises)
      router.replace('/workout/active')
    } finally {
      setLoading(false)
    }
  }

  async function startCustom() {
    const allNames = [...Array.from(selected), ...customExercises]
    if (allNames.length === 0) return
    setLoading(true)
    try {
      const name = workoutName.trim() || 'Custom Workout'
      const workoutId = await createWorkout(name)
      const exercises: ActiveExercise[] = []
      for (let i = 0; i < allNames.length; i++) {
        const exerciseName = allNames[i]
        const ex = await getOrCreateExercise(exerciseName)
        const workoutExerciseId = await addWorkoutExercise(workoutId, ex.id, i, ex.name)
        const prevSets = await getPreviousSets(ex.id)
        const last = prevSets[0]
        exercises.push({
          workoutExerciseId,
          exerciseId: ex.id,
          name: ex.name,
          muscleGroup: ex.muscle_group,
          equipment: ex.equipment,
          target: 'Custom',
          startReps: last?.reps ?? 8,
          startKg: last?.weight_kg ?? 20,
          loggedSets: [],
          previousSets: prevSets,
        })
      }
      useWorkoutStore.getState().startWorkout(workoutId, name, exercises)
      router.replace('/workout/active')
    } finally {
      setLoading(false)
    }
  }

  function addCustomExercise() {
    const name = customInput.trim()
    if (!name || customExercises.includes(name)) return
    setCustomExercises((prev) => [...prev, name])
    setCustomInput('')
  }

  function removeCustom(name: string) {
    setCustomExercises((prev) => prev.filter((n) => n !== name))
  }

  function toggleSelected(name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function handleStartItem(item: ListItem) {
    if (item.kind === 'template') startTemplate(item.index)
    else startUserProgram(item.program)
  }

  const filteredPool = POOL.filter((n) => n.toLowerCase().includes(search.toLowerCase()))
  const totalCustom = selected.size + customExercises.length

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: topInset, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accentMid} size="large" />
        <Text style={styles.loadingText}>Starting workout…</Text>
      </View>
    )
  }

  // ── Custom builder ───────────────────────────────────────────────
  if (view === 'custom') {
    return (
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => setView('list')} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.topLabel}>CUSTOM WORKOUT</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: sp.md }}>
          <TextInput
            style={styles.nameInput}
            value={workoutName}
            onChangeText={setWorkoutName}
            placeholder="Workout name (optional)"
            placeholderTextColor={colors.textSecondary}
          />

          {totalCustom > 0 && (
            <View style={styles.selectedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.accentMid} />
              <Text style={styles.selectedBadgeText}>{totalCustom} exercise{totalCustom !== 1 ? 's' : ''} selected</Text>
            </View>
          )}

          {customExercises.length > 0 && (
            <View style={styles.chipsRow}>
              {customExercises.map((name) => (
                <TouchableOpacity key={name} style={styles.chipActive} onPress={() => removeCustom(name)} activeOpacity={0.8}>
                  <Text style={styles.chipActiveText}>{name}</Text>
                  <Ionicons name="close" size={12} color={colors.accentDark} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.customRow}>
            <TextInput
              style={styles.customInput}
              value={customInput}
              onChangeText={setCustomInput}
              placeholder="Add a custom exercise…"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
              onSubmitEditing={addCustomExercise}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addCustomExercise} activeOpacity={0.85}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Or pick from known exercises</Text>
          <TextInput
            style={[styles.customInput, { marginBottom: sp.sm }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search exercises…"
            placeholderTextColor={colors.textSecondary}
          />
          <View style={styles.poolGrid}>
            {filteredPool.map((name) => {
              const active = selected.has(name)
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.poolChip, active && styles.poolChipActive]}
                  onPress={() => toggleSelected(name)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.poolChipText, active && styles.poolChipTextActive]}>{name}</Text>
                  {active && <Ionicons name="checkmark" size={12} color={colors.accentDark} />}
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.primaryBtn, totalCustom === 0 && styles.primaryBtnDisabled]}
          onPress={startCustom}
          disabled={totalCustom === 0}
          activeOpacity={0.88}
        >
          <Ionicons name="play" size={16} color={totalCustom === 0 ? colors.textMuted : colors.textPrimary} />
          <Text style={[styles.primaryBtnText, totalCustom === 0 && styles.primaryBtnTextDisabled]}>
            {totalCustom === 0 ? 'Add exercises to start' : `Start Workout · ${totalCustom} exercise${totalCustom !== 1 ? 's' : ''}`}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Program list ─────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.topLabel}>START WORKOUT</Text>
        <TouchableOpacity onPress={() => router.push('/workout/create-program')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.newProgramLink}>New Program</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.headline}>What are you{'\n'}training today?</Text>

      {dataLoading ? (
        <ActivityIndicator color={colors.accentMid} style={{ marginTop: sp.xl }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: sp.md }}>
          {/* Custom Workout — always first */}
          <TouchableOpacity style={styles.customCard} onPress={() => setView('custom')} activeOpacity={0.85}>
            <View style={[styles.programIcon, { backgroundColor: colors.surfaceMint }]}>
              <Ionicons name="add-circle-outline" size={22} color={colors.accentMid} />
            </View>
            <View style={styles.programInfo}>
              <Text style={styles.programName}>Custom Workout</Text>
              <Text style={styles.programMeta}>Pick any exercises, train freestyle</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Programs: last 2 recent first, then rest */}
          <View style={styles.programList}>
            {orderedPrograms.map((item, i) => (
              <View key={item.name + i} style={styles.programCard}>
                <View style={[styles.programIcon, { backgroundColor: item.iconBg }]}>
                  <Ionicons name="barbell-outline" size={20} color={item.iconColor} />
                </View>
                <View style={styles.programInfo}>
                  <Text style={styles.programName}>{item.name}</Text>
                  <Text style={styles.programMeta}>{item.sub}</Text>
                  <Text style={styles.programDetail}>
                    {item.exercises} exercises
                    {item.kind === 'template' ? ` · ~${item.duration} min` : ''}
                  </Text>
                </View>
                <TouchableOpacity style={styles.startBtn} onPress={() => handleStartItem(item)} activeOpacity={0.85}>
                  <Text style={styles.startBtnText}>Start</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: sp.md },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp.md,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.xs,
    letterSpacing: 0.6,
  },
  newProgramLink: {
    color: colors.accentDark,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.xs,
  },
  headline: {
    color: colors.textPrimary,
    fontFamily: fonts.serif,
    fontSize: 30,
    lineHeight: 36,
    marginBottom: sp.lg,
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: fs.sm,
    marginTop: sp.md,
  },

  customCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.lg,
    padding: sp.md,
    marginBottom: sp.sm,
  },
  programList: { gap: 10, marginTop: sp.xs },
  programCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    padding: sp.md,
  },
  programIcon: { width: 44, height: 44, borderRadius: r.md, alignItems: 'center', justifyContent: 'center' },
  programInfo: { flex: 1, minWidth: 0 },
  programName: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.md },
  programMeta: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: 2 },
  programDetail: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fs.xs, marginTop: 1 },
  startBtn: {
    backgroundColor: colors.surfaceGreen,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  startBtnText: { color: colors.accentDark, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },

  // Custom builder
  nameInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.lg,
    marginBottom: sp.sm,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: sp.sm,
  },
  selectedBadgeText: { color: colors.accentMid, fontFamily: fonts.sansSemiBold, fontSize: fs.xs },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: sp.sm },
  chipActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceGreen,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActiveText: { color: colors.accentDark, fontFamily: fonts.sansSemiBold, fontSize: fs.xs },
  customRow: { flexDirection: 'row', gap: 8, marginBottom: sp.sm },
  customInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMed,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: 12,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: fs.sm,
  },
  addBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: r.md,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  sectionLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.sm,
    marginBottom: sp.sm,
    marginTop: sp.md,
  },
  poolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  poolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: r.full,
    borderWidth: 1,
    borderColor: colors.borderMed,
    backgroundColor: colors.surface,
  },
  poolChipActive: { backgroundColor: colors.surfaceGreen, borderColor: colors.accentDark },
  poolChipText: { color: colors.textSecondary, fontFamily: fonts.sansSemiBold, fontSize: fs.xs },
  poolChipTextActive: { color: colors.accentDark },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accentLime,
    borderRadius: r.lg,
    paddingVertical: 17,
    marginTop: sp.sm,
  },
  primaryBtnDisabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  primaryBtnText: { color: colors.textPrimary, fontFamily: fonts.sansBold, fontSize: fs.md },
  primaryBtnTextDisabled: { color: colors.textMuted },
})
