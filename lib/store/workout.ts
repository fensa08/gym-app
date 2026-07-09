import { create } from 'zustand'
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
  workoutId: number | null
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

  startWorkout(id: number, name: string, exercises: ActiveExercise[]): void
  setView(view: WorkoutView): void
  setCurrentExercise(index: number): void
  addExercise(exercise: ActiveExercise): void
  addSet(exerciseIndex: number, set: LoggedSet): void
  startRestTimer(duration?: number): void
  stopRestTimer(): void
  setRestDuration(seconds: number): void
  logRest(exerciseIndex: number, exerciseName: string, target: number, actual: number): void
  setOverallRpe(rpe: number): void
  setExerciseRpe(exerciseIndex: number, rpe: number): void
  finishWorkout(): void
  reset(): void
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
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
    })
  },

  setView(view) {
    set({ workoutView: view })
  },

  setCurrentExercise(index) {
    set({ currentExerciseIndex: index, workoutView: 'logging' })
  },

  addExercise(exercise) {
    set({ exercises: [...get().exercises, exercise] })
  },

  addSet(exerciseIndex, loggedSet) {
    const exercises = [...get().exercises]
    const ex = { ...exercises[exerciseIndex] }
    ex.loggedSets = [...ex.loggedSets, loggedSet]
    exercises[exerciseIndex] = ex
    set({ exercises })
  },

  startRestTimer(duration) {
    const d = duration ?? get().restDuration
    set({ workoutView: 'resting', restDuration: d, restTimerEnd: Date.now() + d * 1000 })
  },

  stopRestTimer() {
    set({ workoutView: 'logging', restTimerEnd: null })
  },

  setRestDuration(seconds) {
    set({ restDuration: seconds, restTimerEnd: Date.now() + seconds * 1000 })
  },

  logRest(exerciseIndex, exerciseName, target, actual) {
    set({ restLog: [...get().restLog, { exerciseIndex, exerciseName, target, actual }] })
  },

  setOverallRpe(rpe) {
    set({ overallRpe: rpe })
  },

  setExerciseRpe(exerciseIndex, rpe) {
    set({ perExerciseRpe: { ...get().perExerciseRpe, [exerciseIndex]: rpe } })
  },

  finishWorkout() {
    set({ isActive: false, workoutView: 'summary' })
  },

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
    })
  },
}))
