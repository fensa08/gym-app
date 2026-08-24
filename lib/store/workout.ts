import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ActiveExercise, LoggedSet } from '../types'

type WorkoutView = 'logging' | 'picker' | 'resting' | 'rpe' | 'summary'

export interface RestLogEntry {
  exerciseIndex: number
  exerciseName: string
  target: number
  actual: number
}

interface WorkoutStore {
  isActive: boolean
  workoutId: string | null
  workoutName: string
  startedAt: number | null
  exercises: ActiveExercise[]
  currentExerciseIndex: number
  workoutView: WorkoutView
  restDuration: number
  restTimerEnd: number | null
  restLog: RestLogEntry[]
  overallRpe: number | null
  perExerciseRpe: Record<number, number>
  activeSuperset: number | null
  supersetCount: number

  startWorkout(id: string, name: string, exercises: ActiveExercise[]): void
  startSuperset(): void
  endSuperset(): void
  setView(view: WorkoutView): void
  setCurrentExercise(index: number): void
  addExercise(exercise: ActiveExercise): void
  addSet(exerciseIndex: number, set: LoggedSet): void
  removeSet(exerciseIndex: number, setIndex: number): void
  insertSet(exerciseIndex: number, setIndex: number, set: LoggedSet): void
  startRestTimer(duration?: number): void
  stopRestTimer(): void
  setRestDuration(seconds: number): void
  logRest(exerciseIndex: number, exerciseName: string, target: number, actual: number): void
  setOverallRpe(rpe: number): void
  setExerciseRpe(exerciseIndex: number, rpe: number): void
  finishWorkout(): void
  reset(): void
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
  isActive: false,
  workoutId: null,
  workoutName: '',
  startedAt: null,
  exercises: [],
  currentExerciseIndex: 0,
  workoutView: 'logging',
  restDuration: 60,
  restTimerEnd: null,
  restLog: [],
  overallRpe: null,
  perExerciseRpe: {},
  activeSuperset: null,
  supersetCount: 0,

  startWorkout(id, name, exercises) {
    set({
      isActive: true,
      workoutId: id,
      workoutName: name,
      startedAt: Date.now(),
      exercises,
      currentExerciseIndex: 0,
      workoutView: 'logging',
      restTimerEnd: null,
      activeSuperset: null,
      supersetCount: 0,
    })
  },

  startSuperset() {
    const n = get().supersetCount + 1
    set({ activeSuperset: n, supersetCount: n })
  },

  endSuperset() { set({ activeSuperset: null }) },

  setView(view) { set({ workoutView: view }) },
  setCurrentExercise(index) { set({ currentExerciseIndex: index, workoutView: 'logging' }) },
  addExercise(exercise) { set({ exercises: [...get().exercises, exercise] }) },

  addSet(exerciseIndex, loggedSet) {
    const exercises = [...get().exercises]
    const ex = { ...exercises[exerciseIndex] }
    ex.loggedSets = [...ex.loggedSets, loggedSet]
    exercises[exerciseIndex] = ex
    set({ exercises })
  },

  removeSet(exerciseIndex, setIndex) {
    const exercises = [...get().exercises]
    const ex = { ...exercises[exerciseIndex] }
    ex.loggedSets = ex.loggedSets.filter((_, i) => i !== setIndex)
    exercises[exerciseIndex] = ex
    set({ exercises })
  },

  insertSet(exerciseIndex, setIndex, loggedSet) {
    const exercises = [...get().exercises]
    const ex = { ...exercises[exerciseIndex] }
    ex.loggedSets = [
      ...ex.loggedSets.slice(0, setIndex),
      loggedSet,
      ...ex.loggedSets.slice(setIndex),
    ]
    exercises[exerciseIndex] = ex
    set({ exercises })
  },

  startRestTimer(duration) {
    const d = duration ?? get().restDuration
    set({ workoutView: 'resting', restDuration: d, restTimerEnd: Date.now() + d * 1000 })
  },

  stopRestTimer() { set({ workoutView: 'logging', restTimerEnd: null }) },
  setRestDuration(seconds) { set({ restDuration: seconds, restTimerEnd: Date.now() + seconds * 1000 }) },

  logRest(exerciseIndex, exerciseName, target, actual) {
    set({ restLog: [...get().restLog, { exerciseIndex, exerciseName, target, actual }] })
  },

  setOverallRpe(rpe) { set({ overallRpe: rpe }) },
  setExerciseRpe(exerciseIndex, rpe) {
    set({ perExerciseRpe: { ...get().perExerciseRpe, [exerciseIndex]: rpe } })
  },

  finishWorkout() { set({ isActive: false, workoutView: 'summary' }) },

  reset() {
    set({
      isActive: false,
      workoutId: null,
      workoutName: '',
      startedAt: null,
      exercises: [],
      currentExerciseIndex: 0,
      workoutView: 'logging',
      restTimerEnd: null,
      restLog: [],
      overallRpe: null,
      perExerciseRpe: {},
      activeSuperset: null,
      supersetCount: 0,
    })
  },
    }),
    {
      name: 'workout:active-session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        isActive: s.isActive,
        workoutId: s.workoutId,
        workoutName: s.workoutName,
        startedAt: s.startedAt,
        exercises: s.exercises,
        currentExerciseIndex: s.currentExerciseIndex,
        workoutView: s.workoutView,
        restDuration: s.restDuration,
        restTimerEnd: s.restTimerEnd,
        restLog: s.restLog,
        overallRpe: s.overallRpe,
        perExerciseRpe: s.perExerciseRpe,
        activeSuperset: s.activeSuperset,
        supersetCount: s.supersetCount,
      }),
    }
  )
)
