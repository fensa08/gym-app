import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { useState, useEffect, useRef } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, sp, r, fs } from '../../lib/theme'
import { useWorkoutStore } from '../../lib/store/workout'
import {
  saveSet,
  finishWorkout as dbFinishWorkout,
  getPersonalRecord,
  deleteWorkout,
} from '../../lib/db/queries'
import { SetRow } from '../../components/workout/SetRow'
import { RestTimer } from '../../components/workout/RestTimer'
import type { ActiveExercise, ActiveSet } from '../../lib/types'

const { width: W } = Dimensions.get('window')

export default function ActiveWorkoutScreen() {
  const router = useRouter()
  const db = useSQLiteContext()
  const store = useWorkoutStore()
  const {
    workoutId,
    workoutName,
    exercises,
    currentExerciseIndex,
    restTimerEnd,
    startedAt,
    setCurrentExercise,
    addSet,
    updateSet,
    completeSet,
    startRestTimer,
    stopRestTimer,
    finishWorkout: storeFinish,
    reset,
  } = store

  const flatListRef = useRef<FlatList>(null)
  const [elapsed, setElapsed] = useState(0)
  const [prLabel, setPrLabel] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      if (startedAt) setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [startedAt])

  async function handleCompleteSet(exIdx: number, setIdx: number) {
    const ex = exercises[exIdx]
    const set = ex.sets[setIdx]
    const weightKg = parseFloat(set.weightKg) || null
    const reps = parseInt(set.reps, 10) || null

    let isPR = false
    if (weightKg && ex.workoutExerciseId) {
      const pr = await getPersonalRecord(db, ex.exerciseId)
      if (!pr || weightKg > pr.weight_kg) {
        isPR = true
        setPrLabel(ex.name)
        setTimeout(() => setPrLabel(null), 2500)
      }
    }

    if (ex.workoutExerciseId) {
      await saveSet(db, ex.workoutExerciseId, setIdx + 1, weightKg, reps, isPR)
    }

    completeSet(exIdx, setIdx, isPR)
    startRestTimer()
  }

  function handleFinish() {
    Alert.alert('Finish Workout?', 'Your session will be saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: async () => {
          if (workoutId) await dbFinishWorkout(db, workoutId)
          storeFinish()
          router.back()
        },
      },
    ])
  }

  function handleDiscard() {
    Alert.alert('Discard Workout?', 'All progress will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          if (workoutId) await deleteWorkout(db, workoutId)
          reset()
          router.back()
        },
      },
    ])
  }

  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleDiscard} style={styles.headerBtn}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {workoutName}
          </Text>
          <Text style={styles.headerTimer}>
            {mins}:{String(secs).padStart(2, '0')}
          </Text>
        </View>
        <TouchableOpacity onPress={handleFinish} style={styles.doneBtn}>
          <Text style={styles.doneBtnText}>Finish</Text>
        </TouchableOpacity>
      </View>

      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {exercises.map((_, i) => (
          <TouchableOpacity
            key={i}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            onPress={() => {
              setCurrentExercise(i)
              flatListRef.current?.scrollToIndex({ index: i, animated: true })
            }}
          >
            <View
              style={[
                styles.dot,
                i === currentExerciseIndex && styles.dotActive,
                i < currentExerciseIndex && styles.dotDone,
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* PR banner */}
      {prLabel && (
        <View style={styles.prBanner}>
          <Ionicons name="trophy" size={15} color={colors.accentWarm} />
          <Text style={styles.prText}>New PR — {prLabel}!</Text>
        </View>
      )}

      {/* Exercise pages */}
      <FlatList
        ref={flatListRef}
        data={exercises}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / W)
          setCurrentExercise(idx)
        }}
        renderItem={({ item, index: exIdx }) => (
          <ExercisePage
            exercise={item}
            exIdx={exIdx}
            total={exercises.length}
            onUpdateSet={(si, u) => updateSet(exIdx, si, u)}
            onCompleteSet={(si) => handleCompleteSet(exIdx, si)}
            onAddSet={() => addSet(exIdx)}
          />
        )}
      />

      {/* Rest timer */}
      {restTimerEnd != null && (
        <RestTimer
          endTime={restTimerEnd}
          onComplete={stopRestTimer}
          onSkip={stopRestTimer}
          onAdd30={() => {
            const remaining = Math.max(0, Math.ceil((restTimerEnd - Date.now()) / 1000))
            useWorkoutStore.getState().startRestTimer(remaining + 30)
          }}
        />
      )}
    </SafeAreaView>
  )
}

interface PageProps {
  exercise: ActiveExercise
  exIdx: number
  total: number
  onUpdateSet(si: number, u: Partial<Pick<ActiveSet, 'weightKg' | 'reps'>>): void
  onCompleteSet(si: number): void
  onAddSet(): void
}

function ExercisePage({ exercise, exIdx, total, onUpdateSet, onCompleteSet, onAddSet }: PageProps) {
  return (
    <View style={{ width: W }}>
      {/* Exercise title */}
      <View style={styles.exHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exName}>{exercise.name}</Text>
          <Text style={styles.exMeta}>
            {exercise.muscleGroup} · {exercise.equipment}
          </Text>
        </View>
        <Text style={styles.exCounter}>
          {exIdx + 1} / {total}
        </Text>
      </View>

      <ScrollView
        style={styles.setScroll}
        contentContainerStyle={styles.setScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Column labels */}
        <View style={styles.colRow}>
          <View style={{ width: 28 }}>
            <Text style={styles.col}>SET</Text>
          </View>
          <Text style={[styles.col, { flex: 1 }]}>PREV</Text>
          <Text style={[styles.col, { width: 68 }]}>KG</Text>
          <Text style={[styles.col, { width: 52 }]}>REPS</Text>
          <View style={{ width: 38 }} />
        </View>

        {exercise.sets.map((set, si) => (
          <SetRow
            key={si}
            set={set}
            previous={exercise.previousSets[si]}
            onUpdate={(u) => onUpdateSet(si, u)}
            onComplete={() => onCompleteSet(si)}
          />
        ))}

        <TouchableOpacity style={styles.addSetBtn} onPress={onAddSet}>
          <Ionicons name="add" size={16} color={colors.accent} />
          <Text style={styles.addSetText}>Add Set</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.sm,
    paddingVertical: sp.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: fs.md,
    fontWeight: '700',
    maxWidth: 200,
  },
  headerTimer: {
    color: colors.accent,
    fontSize: fs.sm,
    fontWeight: '600',
    marginTop: 1,
  },
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: r.sm,
    paddingHorizontal: sp.md,
    paddingVertical: 9,
  },
  doneBtnText: { color: '#fff', fontSize: fs.sm, fontWeight: '700' },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: sp.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  dotDone: { backgroundColor: colors.success },
  prBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.accentWarm + '1A',
    marginHorizontal: sp.md,
    borderRadius: r.md,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    marginBottom: sp.xs,
    borderWidth: 1,
    borderColor: colors.accentWarm + '55',
  },
  prText: { color: colors.accentWarm, fontSize: fs.sm, fontWeight: '700' },
  exHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: sp.md,
    paddingTop: sp.sm,
    paddingBottom: sp.md,
  },
  exName: { color: colors.textPrimary, fontSize: fs.xl, fontWeight: '800' },
  exMeta: { color: colors.textSecondary, fontSize: fs.sm, marginTop: 3 },
  exCounter: { color: colors.textSecondary, fontSize: fs.sm, fontWeight: '600' },
  setScroll: { flex: 1, paddingHorizontal: sp.md },
  setScrollContent: { paddingBottom: 200 },
  colRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sp.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: sp.xs,
    gap: sp.sm,
  },
  col: {
    color: colors.textSecondary,
    fontSize: fs.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: sp.md,
    paddingVertical: sp.md,
    backgroundColor: colors.surface,
    borderRadius: r.md,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    borderStyle: 'dashed',
  },
  addSetText: { color: colors.accent, fontSize: fs.sm, fontWeight: '600' },
})
