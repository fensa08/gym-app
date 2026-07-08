import { create } from 'zustand'
import type { ActiveExercise, ActiveSet } from '../types'

interface WorkoutStore {
  isActive: boolean
  workoutId: number | null
  workoutName: string
  startedAt: number | null
  currentExerciseIndex: number
  exercises: ActiveExercise[]
  restTimerEnd: number | null
  restDuration: number

  startWorkout(id: number, name: string, exercises: ActiveExercise[]): void
  setCurrentExercise(index: number): void
  addSet(exerciseIndex: number): void
  updateSet(
    exerciseIndex: number,
    setIndex: number,
    updates: Partial<Pick<ActiveSet, 'weightKg' | 'reps'>>
  ): void
  completeSet(exerciseIndex: number, setIndex: number, isPR?: boolean): void
  startRestTimer(duration?: number): void
  stopRestTimer(): void
  finishWorkout(): void
  reset(): void
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  isActive: false,
  workoutId: null,
  workoutName: '',
  startedAt: null,
  currentExerciseIndex: 0,
  exercises: [],
  restTimerEnd: null,
  restDuration: 120,

  startWorkout(id, name, exercises) {
    set({
      isActive: true,
      workoutId: id,
      workoutName: name,
      startedAt: Date.now(),
      currentExerciseIndex: 0,
      exercises,
      restTimerEnd: null,
    })
  },

  setCurrentExercise(index) {
    set({ currentExerciseIndex: index })
  },

  addSet(exerciseIndex) {
    const exercises = [...get().exercises]
    const ex = { ...exercises[exerciseIndex] }
    const lastSet = ex.sets[ex.sets.length - 1]
    const newSet: ActiveSet = {
      setNumber: ex.sets.length + 1,
      weightKg: lastSet?.weightKg ?? '',
      reps: lastSet?.reps ?? '',
      completed: false,
      isPR: false,
    }
    ex.sets = [...ex.sets, newSet]
    exercises[exerciseIndex] = ex
    set({ exercises })
  },

  updateSet(exerciseIndex, setIndex, updates) {
    const exercises = [...get().exercises]
    const ex = { ...exercises[exerciseIndex] }
    const sets = [...ex.sets]
    sets[setIndex] = { ...sets[setIndex], ...updates }
    ex.sets = sets
    exercises[exerciseIndex] = ex
    set({ exercises })
  },

  completeSet(exerciseIndex, setIndex, isPR = false) {
    const exercises = [...get().exercises]
    const ex = { ...exercises[exerciseIndex] }
    const sets = [...ex.sets]
    sets[setIndex] = { ...sets[setIndex], completed: true, isPR }
    ex.sets = sets
    exercises[exerciseIndex] = ex
    set({ exercises })
  },

  startRestTimer(duration) {
    const d = duration ?? get().restDuration
    set({ restTimerEnd: Date.now() + d * 1000 })
  },

  stopRestTimer() {
    set({ restTimerEnd: null })
  },

  finishWorkout() {
    set({ isActive: false })
  },

  reset() {
    set({
      isActive: false,
      workoutId: null,
      workoutName: '',
      startedAt: null,
      currentExerciseIndex: 0,
      exercises: [],
      restTimerEnd: null,
    })
  },
}))
