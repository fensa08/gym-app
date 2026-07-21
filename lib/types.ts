export interface Exercise {
  id: string
  name: string
  muscle_group: string
  equipment: string
}

export interface Workout {
  id: string
  name: string
  started_at: number
  finished_at: number | null
  notes: string | null
  overall_rpe: number | null
}

export interface LoggedSet {
  reps: number
  kg: number
}

export interface ActiveExercise {
  workoutExerciseId?: string
  exerciseId: string
  name: string
  muscleGroup: string
  equipment: string
  target: string
  startReps: number
  startKg: number
  loggedSets: LoggedSet[]
  previousSets: { weight_kg: number | null; reps: number | null }[]
}

export interface BodyWeightLog {
  id: number
  date: string
  weight_kg: number
  notes: string | null
  logged_at: number
}

export type BodyFatMethod = 'manual' | 'navy' | 'bioimpedance'

export interface BodyCompositionLog {
  id: number
  date: string
  body_fat_pct: number | null
  method: BodyFatMethod | null
  neck_cm: number | null
  height_cm: number | null
  chest_cm: number | null
  waist_cm: number | null
  hips_cm: number | null
  arms_cm: number | null
  thighs_cm: number | null
  calves_cm: number | null
  photo_front: string | null
  photo_side: string | null
  photo_back: string | null
  logged_at: number
}

export type SorenessLevel = 0 | 1 | 2 | 3
export type MuscleGroupKey = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms'

export interface RecoveryLog {
  id: number
  date: string
  sleep_hours: number | null
  sleep_quality: number | null
  stress_level: number | null
  resting_hr: number | null
  hrv: number | null
  soreness_chest: SorenessLevel
  soreness_back: SorenessLevel
  soreness_legs: SorenessLevel
  soreness_shoulders: SorenessLevel
  soreness_arms: SorenessLevel
  logged_at: number
}

export interface NutritionLog {
  id: number
  date: string
  calories: number | null
  protein_g: number | null
  water_ml: number | null
  pre_workout_meal: 0 | 1
  post_workout_meal: 0 | 1
  notes: string | null
  logged_at: number
}

export interface UserGoals {
  id: number
  calorie_goal: number
  protein_goal: number
  water_goal_ml: number
  height_cm: number
}
