import type { SQLiteDatabase } from 'expo-sqlite'
import type { Exercise, Workout } from '../types'

export async function getAllExercises(db: SQLiteDatabase): Promise<Exercise[]> {
  return db.getAllAsync<Exercise>('SELECT * FROM exercises ORDER BY muscle_group, name')
}

export async function searchExercises(db: SQLiteDatabase, query: string): Promise<Exercise[]> {
  return db.getAllAsync<Exercise>(
    'SELECT * FROM exercises WHERE name LIKE ? OR muscle_group LIKE ? ORDER BY muscle_group, name',
    [`%${query}%`, `%${query}%`]
  )
}

export async function getExercisesByName(db: SQLiteDatabase, names: string[]): Promise<Exercise[]> {
  if (names.length === 0) return []
  const placeholders = names.map(() => '?').join(', ')
  return db.getAllAsync<Exercise>(
    `SELECT * FROM exercises WHERE name IN (${placeholders})`,
    names
  )
}

export async function createWorkout(db: SQLiteDatabase, name: string): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO workouts (name, started_at) VALUES (?, ?)',
    [name, Date.now()]
  )
  return result.lastInsertRowId
}

export async function finishWorkout(db: SQLiteDatabase, workoutId: number): Promise<void> {
  await db.runAsync(
    'UPDATE workouts SET finished_at = ? WHERE id = ?',
    [Date.now(), workoutId]
  )
}

export async function deleteWorkout(db: SQLiteDatabase, workoutId: number): Promise<void> {
  await db.runAsync('DELETE FROM workouts WHERE id = ?', [workoutId])
}

export async function addWorkoutExercise(
  db: SQLiteDatabase,
  workoutId: number,
  exerciseId: number,
  orderIndex: number
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, ?)',
    [workoutId, exerciseId, orderIndex]
  )
  return result.lastInsertRowId
}

export async function saveSet(
  db: SQLiteDatabase,
  workoutExerciseId: number,
  setNumber: number,
  weightKg: number | null,
  reps: number | null,
  isPR: boolean
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO sets (workout_exercise_id, set_number, weight_kg, reps, completed, is_pr, completed_at) VALUES (?, ?, ?, ?, 1, ?, ?)',
    [workoutExerciseId, setNumber, weightKg, reps, isPR ? 1 : 0, Date.now()]
  )
  return result.lastInsertRowId
}

export async function getPreviousSets(
  db: SQLiteDatabase,
  exerciseId: number
): Promise<{ weight_kg: number | null; reps: number | null }[]> {
  return db.getAllAsync<{ weight_kg: number | null; reps: number | null }>(
    `SELECT s.weight_kg, s.reps
     FROM sets s
     JOIN workout_exercises we ON s.workout_exercise_id = we.id
     JOIN workouts w ON we.workout_id = w.id
     WHERE we.exercise_id = ?
       AND w.finished_at IS NOT NULL
       AND s.completed = 1
     ORDER BY w.finished_at DESC, s.set_number ASC
     LIMIT 6`,
    [exerciseId]
  )
}

export async function getPersonalRecord(
  db: SQLiteDatabase,
  exerciseId: number
): Promise<{ weight_kg: number; reps: number } | null> {
  return db.getFirstAsync<{ weight_kg: number; reps: number }>(
    `SELECT weight_kg, reps FROM sets s
     JOIN workout_exercises we ON s.workout_exercise_id = we.id
     WHERE we.exercise_id = ? AND s.completed = 1 AND s.weight_kg IS NOT NULL
     ORDER BY s.weight_kg DESC, s.reps DESC
     LIMIT 1`,
    [exerciseId]
  )
}

export async function getRecentWorkouts(db: SQLiteDatabase, limit = 10): Promise<Workout[]> {
  return db.getAllAsync<Workout>(
    'SELECT * FROM workouts WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT ?',
    [limit]
  )
}

export async function getWorkoutStats(
  db: SQLiteDatabase,
  workoutId: number
): Promise<{ exercise_count: number; set_count: number; volume: number } | null> {
  return db.getFirstAsync<{ exercise_count: number; set_count: number; volume: number }>(
    `SELECT
       COUNT(DISTINCT we.id) as exercise_count,
       COUNT(s.id) as set_count,
       COALESCE(SUM(CASE WHEN s.weight_kg IS NOT NULL AND s.reps IS NOT NULL THEN s.weight_kg * s.reps ELSE 0 END), 0) as volume
     FROM workout_exercises we
     LEFT JOIN sets s ON s.workout_exercise_id = we.id AND s.completed = 1
     WHERE we.workout_id = ?`,
    [workoutId]
  )
}

export async function getWeeklyVolume(
  db: SQLiteDatabase
): Promise<{ day: string; volume: number }[]> {
  return db.getAllAsync<{ day: string; volume: number }>(
    `SELECT
       date(w.started_at / 1000, 'unixepoch') as day,
       COALESCE(SUM(s.weight_kg * s.reps), 0) as volume
     FROM workouts w
     JOIN workout_exercises we ON we.workout_id = w.id
     JOIN sets s ON s.workout_exercise_id = we.id
     WHERE s.completed = 1
       AND s.weight_kg IS NOT NULL
       AND w.started_at >= ?
     GROUP BY day
     ORDER BY day`,
    [Date.now() - 7 * 24 * 60 * 60 * 1000]
  )
}

export async function getAllPRs(
  db: SQLiteDatabase
): Promise<{ exercise_name: string; weight_kg: number; reps: number }[]> {
  return db.getAllAsync<{ exercise_name: string; weight_kg: number; reps: number }>(
    `SELECT e.name as exercise_name, s.weight_kg, s.reps
     FROM sets s
     JOIN workout_exercises we ON s.workout_exercise_id = we.id
     JOIN exercises e ON we.exercise_id = e.id
     WHERE s.is_pr = 1
     GROUP BY we.exercise_id
     ORDER BY s.weight_kg DESC`
  )
}
