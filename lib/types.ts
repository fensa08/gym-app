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

export interface ActiveSet {
  id?: number
  setNumber: number
  weightKg: string
  reps: string
  completed: boolean
  isPR: boolean
}

export interface ActiveExercise {
  workoutExerciseId?: number
  exerciseId: number
  name: string
  muscleGroup: string
  equipment: string
  sets: ActiveSet[]
  previousSets: { weightKg: number | null; reps: number | null }[]
}
