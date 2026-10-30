import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Alert, TextInput } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { format, formatDuration, intervalToDuration } from 'date-fns'
import { colors, sp, r, fs, fonts } from '../../lib/theme'
import {
  getWorkoutDetail,
  deleteWorkout,
  updateSet,
  deleteSet,
  saveSet,
  type WorkoutDetail,
  type WorkoutDetailSet,
} from '../../lib/firestore/queries'
import { errorMessage } from '../../lib/errors'
import { useWorkoutStore } from '../../lib/store/workout'
import { buildWorkoutFromTemplate, templateFromWorkout } from '../../lib/workoutHelpers'

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [repeating, setRepeating] = useState(false)

  useEffect(() => {
    if (id) {
      getWorkoutDetail(id)
        .then((w) => {
          setWorkout(w)
          setLoading(false)
        })
        .catch((err) => {
          console.error(err)
          setLoadError(errorMessage(err))
          setLoading(false)
        })
    }
  }, [id])

  const topInset = Math.max(insets.top, 54)
  const bottomInset = Math.max(insets.bottom, sp.md)

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: topInset }]}>
        <ActivityIndicator color={colors.accentMid} />
      </View>
    )
  }

  if (!workout) {
    return (
      <View style={[styles.centered, { paddingTop: topInset }]}>
        <Text style={styles.errorText}>{loadError ?? 'Workout not found.'}</Text>
      </View>
    )
  }

  const duration = (() => {
    if (!workout.started_at || !workout.finished_at) return null
    const d = intervalToDuration({ start: workout.started_at, end: workout.finished_at })
    return formatDuration(d, { format: ['hours', 'minutes'] }) || null
  })()

  const totalVolume = workout.volume >= 1000
    ? `${(workout.volume / 1000).toFixed(1)}k`
    : String(Math.round(workout.volume))

  async function confirmDelete() {
    setShowDeleteModal(false)
    try {
      await deleteWorkout(id!)
      router.back()
    } catch (err) {
      console.error(err)
      Alert.alert('Failed to delete workout', errorMessage(err))
    }
  }

  async function handleRepeat() {
    if (!workout || repeating) return
    if (useWorkoutStore.getState().isActive) {
      Alert.alert('Workout in progress', 'Finish or resume your current workout first.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Resume', onPress: () => router.replace('/workout/active') },
      ])
      return
    }
    setRepeating(true)
    try {
      const { workoutId, exercises } = await buildWorkoutFromTemplate(templateFromWorkout(workout))
      if (exercises.length === 0) throw new Error('No exercises found to repeat.')
      useWorkoutStore.getState().startWorkout(workoutId, workout.name, exercises)
      router.replace('/workout/active')
    } catch (err) {
      console.error(err)
      Alert.alert('Could not start workout', errorMessage(err))
    } finally {
      setRepeating(false)
    }
  }

  function patchSet(workoutExerciseId: string, setId: string, patch: Partial<WorkoutDetailSet>) {
    setWorkout((w) => {
      if (!w) return w
      return {
        ...w,
        exercises: w.exercises.map((ex) =>
          ex.workoutExerciseId !== workoutExerciseId
            ? ex
            : { ...ex, sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }
        ),
      }
    })
  }

  async function handleUpdateSet(
    workoutExerciseId: string,
    setId: string,
    field: 'weight_kg' | 'reps',
    value: number | null
  ) {
    patchSet(workoutExerciseId, setId, { [field]: value })
    try {
      await updateSet(id!, workoutExerciseId, setId, {
        [field === 'weight_kg' ? 'weightKg' : 'reps']: value,
      })
    } catch (err) {
      console.error(err)
      Alert.alert('Failed to update set', errorMessage(err))
    }
  }

  async function handleDeleteSet(workoutExerciseId: string, setId: string) {
    setWorkout((w) => {
      if (!w) return w
      return {
        ...w,
        exercises: w.exercises.map((ex) =>
          ex.workoutExerciseId !== workoutExerciseId
            ? ex
            : { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
        ),
      }
    })
    try {
      await deleteSet(id!, workoutExerciseId, setId)
    } catch (err) {
      console.error(err)
      Alert.alert('Failed to delete set', errorMessage(err))
    }
  }

  async function handleAddSet(workoutExerciseId: string, nextSetNumber: number) {
    try {
      const setId = await saveSet(id!, workoutExerciseId, nextSetNumber, null, null, false)
      setWorkout((w) => {
        if (!w) return w
        return {
          ...w,
          exercises: w.exercises.map((ex) =>
            ex.workoutExerciseId !== workoutExerciseId
              ? ex
              : {
                  ...ex,
                  sets: [
                    ...ex.sets,
                    {
                      id: setId,
                      set_number: nextSetNumber,
                      weight_kg: null,
                      reps: null,
                      is_pr: false,
                      completed: true,
                      superset: null,
                    },
                  ],
                }
          ),
        }
      })
    } catch (err) {
      console.error(err)
      Alert.alert('Failed to add set', errorMessage(err))
    }
  }

  return (
    <View style={[styles.root, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{workout.name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.editIconBtn}
            onPress={() => setEditMode((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={editMode ? 'checkmark' : 'pencil-outline'}
              size={18}
              color={colors.accentDark}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteIconBtn}
            onPress={() => setShowDeleteModal(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Date & duration */}
        <Text style={styles.dateText}>
          {format(new Date(workout.finished_at), 'EEEE, MMMM d, yyyy')}
        </Text>
        {duration && <Text style={styles.durationText}>{duration}</Text>}

        {/* Summary chips */}
        <View style={styles.statsRow}>
          <StatChip icon="barbell-outline" value={String(workout.exercise_count)} label="Exercises" />
          <StatChip icon="layers-outline" value={String(workout.set_count)} label="Sets" />
          <StatChip icon="trending-up-outline" value={totalVolume} label="kg Volume" />
          {workout.overall_rpe != null && (
            <StatChip icon="speedometer-outline" value={String(workout.overall_rpe)} label="RPE" />
          )}
        </View>

        {workout.exercises.length > 0 && (
          <TouchableOpacity style={styles.repeatBtn} onPress={handleRepeat} disabled={repeating || editMode} activeOpacity={0.85}>
            {repeating ? <ActivityIndicator color={colors.accentDark} /> : (<>
              <Ionicons name="repeat" size={16} color={colors.accentDark} />
              <Text style={styles.repeatText}>Repeat</Text></>)}
          </TouchableOpacity>
        )}

        {/* Exercises */}
        <Text style={styles.sectionLabel}>EXERCISES</Text>
        {workout.exercises.map((ex, i) => {
          const exVolume = ex.sets.reduce(
            (sum, s) => sum + (s.weight_kg != null && s.reps != null ? s.weight_kg * s.reps : 0),
            0
          )
          return (
            <View key={ex.workoutExerciseId} style={styles.exCard}>
              <View style={styles.exHeader}>
                <View style={styles.exIndex}>
                  <Text style={styles.exIndexText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exName}>{ex.exercise_name}</Text>
                  <Text style={styles.exMeta}>
                    {ex.sets.length} set{ex.sets.length !== 1 ? 's' : ''}
                    {exVolume > 0 ? ` · ${Math.round(exVolume)} kg vol` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.setTable}>
                <View style={styles.setTableHeader}>
                  <Text style={[styles.setCol, styles.setHeaderText]}>SET</Text>
                  <Text style={[styles.setColMid, styles.setHeaderText]}>REPS</Text>
                  <Text style={[styles.setColMid, styles.setHeaderText]}>WEIGHT</Text>
                  <Text style={[styles.setColRight, styles.setHeaderText]}>VOL</Text>
                  {editMode && <View style={styles.setColDelete} />}
                </View>
                {ex.sets.map((s, si) => {
                  const setVol = s.weight_kg != null && s.reps != null
                    ? s.weight_kg * s.reps
                    : null
                  return (
                    <View
                      key={s.id ?? si}
                      style={[styles.setRow, si < ex.sets.length - 1 && styles.setRowBorder]}
                    >
                      <View style={[styles.setCol, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                        <Text style={styles.setCellMono}>{s.set_number ?? si + 1}</Text>
                        {s.is_pr && (
                          <Ionicons name="trophy" size={11} color={colors.accentMid} />
                        )}
                      </View>
                      {editMode ? (
                        <EditableCell
                          style={styles.setColMid}
                          value={s.reps}
                          suffix=""
                          onCommit={(v) => handleUpdateSet(ex.workoutExerciseId, s.id, 'reps', v)}
                        />
                      ) : (
                        <Text style={[styles.setColMid, styles.setCell]}>
                          {s.reps != null ? s.reps : '—'}
                        </Text>
                      )}
                      {editMode ? (
                        <EditableCell
                          style={styles.setColMid}
                          value={s.weight_kg}
                          suffix=" kg"
                          onCommit={(v) => handleUpdateSet(ex.workoutExerciseId, s.id, 'weight_kg', v)}
                        />
                      ) : (
                        <Text style={[styles.setColMid, styles.setCell]}>
                          {s.weight_kg != null ? `${s.weight_kg} kg` : '—'}
                        </Text>
                      )}
                      <Text style={[styles.setColRight, styles.setCellMono]}>
                        {setVol != null ? `${Math.round(setVol)}` : '—'}
                      </Text>
                      {editMode && (
                        <TouchableOpacity
                          style={styles.setColDelete}
                          onPress={() => handleDeleteSet(ex.workoutExerciseId, s.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={16} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )
                })}
              </View>
              {editMode && (
                <TouchableOpacity
                  style={styles.addSetBtn}
                  onPress={() => handleAddSet(ex.workoutExerciseId, ex.sets.length + 1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={16} color={colors.accentDark} />
                  <Text style={styles.addSetText}>Add Set</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        })}
      </ScrollView>

      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Workout?</Text>
            <Text style={styles.modalBody}>
              This will permanently remove the workout and all its data.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowDeleteModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteBtn}
                onPress={confirmDelete}
                activeOpacity={0.8}
              >
                <Text style={styles.modalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function EditableCell({
  value,
  suffix,
  style,
  onCommit,
}: {
  value: number | null
  suffix: string
  style?: object
  onCommit(v: number | null): void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEdit() {
    setDraft(value != null ? String(value) : '')
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed === '') {
      onCommit(null)
      return
    }
    const parsed = parseFloat(trimmed.replace(',', '.'))
    if (!isNaN(parsed) && parsed >= 0) {
      onCommit(parsed)
    }
  }

  if (editing) {
    return (
      <TextInput
        style={[style, styles.setCellInput]}
        value={draft}
        onChangeText={setDraft}
        keyboardType="decimal-pad"
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={commit}
        onBlur={commit}
      />
    )
  }

  return (
    <TouchableOpacity style={style} onPress={startEdit} activeOpacity={0.6}>
      <Text style={styles.setCellEditable}>
        {value != null ? `${value}${suffix}` : '—'}
      </Text>
    </TouchableOpacity>
  )
}

function StatChip({
  icon,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  value: string
  label: string
}) {
  return (
    <View style={styles.statChip}>
      <Ionicons name={icon} size={16} color={colors.accentDark} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fs.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.md,
    paddingBottom: sp.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.md,
    textAlign: 'center',
    marginHorizontal: sp.sm,
  },
  content: { padding: sp.md, paddingBottom: 40 },
  dateText: {
    color: colors.textPrimary,
    fontFamily: fonts.serif,
    fontSize: 22,
    marginBottom: 2,
  },
  durationText: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: fs.sm,
    marginBottom: sp.md,
  },
  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: sp.lg },
  statChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 3,
    minWidth: 72,
  },
  statValue: {
    color: colors.textPrimary,
    fontFamily: fonts.monoSemiBold,
    fontSize: fs.md,
  },
  statLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 10,
  },
  repeatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceGreen,
    borderRadius: r.lg,
    paddingVertical: 12,
    marginBottom: sp.lg,
  },
  repeatText: { color: colors.accentDark, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  sectionLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.xs,
    letterSpacing: 0.8,
    marginBottom: sp.sm,
  },
  exCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: r.lg,
    marginBottom: 12,
    overflow: 'hidden',
  },
  exHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: sp.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  exIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exIndexText: {
    color: colors.accentDark,
    fontFamily: fonts.sansBold,
    fontSize: fs.xs,
  },
  exName: {
    color: colors.textPrimary,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.sm,
  },
  exMeta: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: fs.xs,
    marginTop: 2,
  },
  setTable: { paddingHorizontal: sp.md },
  setTableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  setHeaderText: {
    color: colors.textSecondary,
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  setRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  setCol: { width: 36 },
  setColMid: { flex: 1 },
  setColRight: { width: 52, textAlign: 'right' },
  setCell: {
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: fs.sm,
  },
  setCellMono: {
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: fs.sm,
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(224,87,92,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setColDelete: { width: 24, alignItems: 'center' },
  setCellEditable: {
    color: colors.accentDark,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.sm,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  setCellInput: {
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: fs.sm,
    borderWidth: 1,
    borderColor: colors.accentMid,
    borderRadius: r.sm,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addSetText: {
    color: colors.accentDark,
    fontFamily: fonts.sansSemiBold,
    fontSize: fs.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: sp.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: r.xl,
    padding: sp.lg,
    width: '100%',
    gap: sp.md,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.sansBold,
    fontSize: fs.lg,
    textAlign: 'center',
  },
  modalBody: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: fs.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: sp.sm },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: colors.surfaceInput,
    borderRadius: r.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: { color: colors.textPrimary, fontFamily: fonts.sansSemiBold, fontSize: fs.sm },
  modalDeleteBtn: {
    flex: 1,
    backgroundColor: colors.error,
    borderRadius: r.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalDeleteText: { color: '#fff', fontFamily: fonts.sansBold, fontSize: fs.sm },
})
