import type { SQLiteDatabase } from 'expo-sqlite'

export async function initDB(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      muscle_group TEXT NOT NULL,
      equipment TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS workout_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      order_index INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      weight_kg REAL,
      reps INTEGER,
      completed INTEGER NOT NULL DEFAULT 0,
      is_pr INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER
    );
  `)
}
