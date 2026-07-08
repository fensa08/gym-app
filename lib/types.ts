export interface Exercise {
  id: number
  name: string
  muscle_group: string
  equipment: string
}

export interface Workout {
  id: number
  name: string
  started_at: number
  finished_at: number | null
  notes: string | null
}

export interface LoggedSet {
  reps: number
  kg: number
}

export interface ActiveExercise {
  workoutExerciseId?: number
  exerciseId: number
  name: string
  muscleGroup: string
  equipment: string
  target: string
  startReps: number
  startKg: number
  loggedSets: LoggedSet[]
}
