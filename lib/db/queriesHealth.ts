import type { SQLiteDatabase } from 'expo-sqlite'
import type {
  BodyWeightLog,
  BodyCompositionLog,
  BodyFatMethod,
  RecoveryLog,
  NutritionLog,
  UserGoals,
} from '../types'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Body weight ──────────────────────────────────────────────────
export async function upsertBodyWeightLog(
  db: SQLiteDatabase,
  weightKg: number,
  date: string = today(),
  notes: string | null = null
): Promise<void> {
  await db.runAsync(
    `INSERT INTO body_weight_logs (date, weight_kg, notes, logged_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg, notes = excluded.notes, logged_at = excluded.logged_at`,
    [date, weightKg, notes, Date.now()]
  )
}

export async function getBodyWeightLogs(db: SQLiteDatabase, days = 30): Promise<BodyWeightLog[]> {
  return db.getAllAsync<BodyWeightLog>(
    `SELECT * FROM body_weight_logs WHERE date >= date('now', ?) ORDER BY date ASC`,
    [`-${days} days`]
  )
}

export async function getLatestBodyWeight(db: SQLiteDatabase): Promise<BodyWeightLog | null> {
  return db.getFirstAsync<BodyWeightLog>('SELECT * FROM body_weight_logs ORDER BY date DESC LIMIT 1')
}

export async function getDaysSinceLastMeasurement(db: SQLiteDatabase): Promise<number | null> {
  const row = await db.getFirstAsync<{ date: string }>(
    'SELECT date FROM body_composition_logs ORDER BY date DESC LIMIT 1'
  )
  if (!row) return null
  return Math.floor((Date.now() - new Date(row.date).getTime()) / 86400000)
}

// ── Body composition ─────────────────────────────────────────────
export interface BodyCompositionInput {
  body_fat_pct?: number | null
  method?: BodyFatMethod | null
  neck_cm?: number | null
  height_cm?: number | null
  chest_cm?: number | null
  waist_cm?: number | null
  hips_cm?: number | null
  arms_cm?: number | null
  thighs_cm?: number | null
  calves_cm?: number | null
  photo_front?: string | null
  photo_side?: string | null
  photo_back?: string | null
}

export async function insertBodyCompositionLog(
  db: SQLiteDatabase,
  input: BodyCompositionInput,
  date: string = today()
): Promise<void> {
  await db.runAsync(
    `INSERT INTO body_composition_logs
      (date, body_fat_pct, method, neck_cm, height_cm, chest_cm, waist_cm, hips_cm, arms_cm, thighs_cm, calves_cm, photo_front, photo_side, photo_back, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      date,
      input.body_fat_pct ?? null,
      input.method ?? null,
      input.neck_cm ?? null,
      input.height_cm ?? null,
      input.chest_cm ?? null,
      input.waist_cm ?? null,
      input.hips_cm ?? null,
      input.arms_cm ?? null,
      input.thighs_cm ?? null,
      input.calves_cm ?? null,
      input.photo_front ?? null,
      input.photo_side ?? null,
      input.photo_back ?? null,
      Date.now(),
    ]
  )
}

export async function getLatestBodyComposition(db: SQLiteDatabase): Promise<BodyCompositionLog | null> {
  return db.getFirstAsync<BodyCompositionLog>('SELECT * FROM body_composition_logs ORDER BY date DESC, logged_at DESC LIMIT 1')
}

export async function getBodyCompositionHistory(db: SQLiteDatabase, days = 60): Promise<BodyCompositionLog[]> {
  return db.getAllAsync<BodyCompositionLog>(
    `SELECT * FROM body_composition_logs WHERE date >= date('now', ?) ORDER BY date ASC`,
    [`-${days} days`]
  )
}

// ── Recovery ──────────────────────────────────────────────────────
export interface RecoveryInput {
  sleep_hours?: number | null
  sleep_quality?: number | null
  stress_level?: number | null
  resting_hr?: number | null
  hrv?: number | null
  soreness_chest?: number
  soreness_back?: number
  soreness_legs?: number
  soreness_shoulders?: number
  soreness_arms?: number
}

export async function upsertRecoveryLog(
  db: SQLiteDatabase,
  input: RecoveryInput,
  date: string = today()
): Promise<void> {
  await db.runAsync(
    `INSERT INTO recovery_logs
      (date, sleep_hours, sleep_quality, stress_level, resting_hr, hrv, soreness_chest, soreness_back, soreness_legs, soreness_shoulders, soreness_arms, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       sleep_hours = excluded.sleep_hours,
       sleep_quality = excluded.sleep_quality,
       stress_level = excluded.stress_level,
       resting_hr = excluded.resting_hr,
       hrv = excluded.hrv,
       soreness_chest = excluded.soreness_chest,
       soreness_back = excluded.soreness_back,
       soreness_legs = excluded.soreness_legs,
       soreness_shoulders = excluded.soreness_shoulders,
       soreness_arms = excluded.soreness_arms,
       logged_at = excluded.logged_at`,
    [
      date,
      input.sleep_hours ?? null,
      input.sleep_quality ?? null,
      input.stress_level ?? null,
      input.resting_hr ?? null,
      input.hrv ?? null,
      input.soreness_chest ?? 0,
      input.soreness_back ?? 0,
      input.soreness_legs ?? 0,
      input.soreness_shoulders ?? 0,
      input.soreness_arms ?? 0,
      Date.now(),
    ]
  )
}

export async function getLatestRecoveryLog(db: SQLiteDatabase): Promise<RecoveryLog | null> {
  return db.getFirstAsync<RecoveryLog>('SELECT * FROM recovery_logs ORDER BY date DESC LIMIT 1')
}

export async function getRecoveryLogs(db: SQLiteDatabase, days = 7): Promise<RecoveryLog[]> {
  return db.getAllAsync<RecoveryLog>(
    `SELECT * FROM recovery_logs WHERE date >= date('now', ?) ORDER BY date ASC`,
    [`-${days - 1} days`]
  )
}

export function readinessScore(log: Pick<RecoveryLog, 'sleep_hours' | 'hrv' | 'resting_hr'> | null): number | null {
  if (!log) return null
  const parts: number[] = []
  if (log.sleep_hours != null) parts.push(Math.max(0, Math.min(10, (log.sleep_hours / 8) * 10)))
  if (log.hrv != null) parts.push(Math.max(0, Math.min(10, (log.hrv / 65) * 10)))
  if (log.resting_hr != null) parts.push(Math.max(0, Math.min(10, 10 - (log.resting_hr - 50) / 4)))
  if (parts.length === 0) return null
  return Math.round((parts.reduce((s, v) => s + v, 0) / parts.length) * 10) / 10
}

// ── Nutrition ─────────────────────────────────────────────────────
export interface NutritionInput {
  calories?: number | null
  protein_g?: number | null
  water_ml?: number | null
  pre_workout_meal?: boolean
  post_workout_meal?: boolean
  notes?: string | null
}

export async function upsertNutritionLog(
  db: SQLiteDatabase,
  input: NutritionInput,
  date: string = today()
): Promise<void> {
  await db.runAsync(
    `INSERT INTO nutrition_logs (date, calories, protein_g, water_ml, pre_workout_meal, post_workout_meal, notes, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       calories = excluded.calories,
       protein_g = excluded.protein_g,
       water_ml = excluded.water_ml,
       pre_workout_meal = excluded.pre_workout_meal,
       post_workout_meal = excluded.post_workout_meal,
       notes = excluded.notes,
       logged_at = excluded.logged_at`,
    [
      date,
      input.calories ?? null,
      input.protein_g ?? null,
      input.water_ml ?? null,
      input.pre_workout_meal ? 1 : 0,
      input.post_workout_meal ? 1 : 0,
      input.notes ?? null,
      Date.now(),
    ]
  )
}

export async function getTodayNutritionLog(db: SQLiteDatabase): Promise<NutritionLog | null> {
  return db.getFirstAsync<NutritionLog>('SELECT * FROM nutrition_logs WHERE date = ?', [today()])
}

export async function getNutritionLogs(db: SQLiteDatabase, days = 7): Promise<NutritionLog[]> {
  return db.getAllAsync<NutritionLog>(
    `SELECT * FROM nutrition_logs WHERE date >= date('now', ?) ORDER BY date ASC`,
    [`-${days - 1} days`]
  )
}

export async function getNutritionStreaks(
  db: SQLiteDatabase,
  calorieGoal: number
): Promise<{ surplusStreak: number; deficitStreak: number }> {
  const rows = await db.getAllAsync<{ date: string; calories: number | null }>(
    `SELECT date, calories FROM nutrition_logs WHERE calories IS NOT NULL ORDER BY date DESC LIMIT 60`
  )
  let surplusStreak = 0
  let deficitStreak = 0
  for (const row of rows) {
    if (row.calories == null) break
    if (row.calories > calorieGoal) {
      if (deficitStreak > 0) break
      surplusStreak++
    } else {
      if (surplusStreak > 0) break
      deficitStreak++
    }
  }
  return { surplusStreak, deficitStreak }
}

// ── Goals / settings ─────────────────────────────────────────────
export async function getUserGoals(db: SQLiteDatabase): Promise<UserGoals> {
  const row = await db.getFirstAsync<UserGoals>('SELECT * FROM user_goals WHERE id = 1')
  return row ?? { id: 1, calorie_goal: 2400, protein_goal: 160, water_goal_ml: 3000, height_cm: 178 }
}

export async function updateUserGoals(db: SQLiteDatabase, goals: Partial<Omit<UserGoals, 'id'>>): Promise<void> {
  const current = await getUserGoals(db)
  const merged = { ...current, ...goals }
  await db.runAsync(
    'UPDATE user_goals SET calorie_goal = ?, protein_goal = ?, water_goal_ml = ?, height_cm = ? WHERE id = 1',
    [merged.calorie_goal, merged.protein_goal, merged.water_goal_ml, merged.height_cm]
  )
}

// ── RPE / rest ────────────────────────────────────────────────────
export async function setWorkoutRpe(db: SQLiteDatabase, workoutId: number, rpe: number): Promise<void> {
  await db.runAsync('UPDATE workouts SET overall_rpe = ? WHERE id = ?', [rpe, workoutId])
}

export async function setExerciseRpe(db: SQLiteDatabase, workoutExerciseId: number, rpe: number): Promise<void> {
  await db.runAsync('UPDATE sets SET rpe = ? WHERE workout_exercise_id = ?', [rpe, workoutExerciseId])
}

// ── Staleness detection ───────────────────────────────────────────
export async function getStaleExercises(
  db: SQLiteDatabase,
  staleDays = 21
): Promise<{ exercise_id: number; exercise_name: string; days_since_pr: number }[]> {
  const rows = await db.getAllAsync<{ exercise_id: number; exercise_name: string; last_pr_at: number }>(
    `SELECT we.exercise_id as exercise_id, e.name as exercise_name, MAX(s.completed_at) as last_pr_at
     FROM sets s
     JOIN workout_exercises we ON s.workout_exercise_id = we.id
     JOIN exercises e ON we.exercise_id = e.id
     WHERE s.is_pr = 1
     GROUP BY we.exercise_id`
  )
  const resolved = await db.getAllAsync<{ exercise_id: number }>('SELECT exercise_id FROM resolved_staleness')
  const resolvedSet = new Set(resolved.map((r) => r.exercise_id))
  const cutoff = staleDays * 86400000
  return rows
    .filter((r) => !resolvedSet.has(r.exercise_id) && Date.now() - r.last_pr_at > cutoff)
    .map((r) => ({
      exercise_id: r.exercise_id,
      exercise_name: r.exercise_name,
      days_since_pr: Math.floor((Date.now() - r.last_pr_at) / 86400000),
    }))
    .sort((a, b) => b.days_since_pr - a.days_since_pr)
}

export async function markStalenessResolved(db: SQLiteDatabase, exerciseId: number): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO resolved_staleness (exercise_id, resolved_at) VALUES (?, ?)',
    [exerciseId, Date.now()]
  )
}

// ── Calorie calibration ───────────────────────────────────────────
export async function getMaintenanceCalibration(
  db: SQLiteDatabase
): Promise<{ avgIntake: number; weightChangePerWeek: number; daysLogged: number } | null> {
  const nutritionRows = await db.getAllAsync<{ calories: number }>(
    `SELECT calories FROM nutrition_logs WHERE calories IS NOT NULL AND date >= date('now', '-14 days')`
  )
  if (nutritionRows.length < 14) return null
  const avgIntake = nutritionRows.reduce((s, r) => s + r.calories, 0) / nutritionRows.length

  const weightRows = await db.getAllAsync<{ date: string; weight_kg: number }>(
    `SELECT date, weight_kg FROM body_weight_logs WHERE date >= date('now', '-14 days') ORDER BY date ASC`
  )
  let weightChangePerWeek = 0
  if (weightRows.length >= 2) {
    const first = weightRows[0]
    const last = weightRows[weightRows.length - 1]
    const days = Math.max(
      1,
      (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000
    )
    weightChangePerWeek = ((last.weight_kg - first.weight_kg) / days) * 7
  }
  return { avgIntake, weightChangePerWeek, daysLogged: nutritionRows.length }
}
