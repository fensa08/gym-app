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
      notes TEXT,
      overall_rpe REAL
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
      rpe REAL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS body_weight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      weight_kg REAL NOT NULL,
      notes TEXT,
      logged_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS body_composition_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      body_fat_pct REAL,
      method TEXT,
      neck_cm REAL,
      height_cm REAL,
      chest_cm REAL,
      waist_cm REAL,
      hips_cm REAL,
      arms_cm REAL,
      thighs_cm REAL,
      calves_cm REAL,
      photo_front TEXT,
      photo_side TEXT,
      photo_back TEXT,
      logged_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recovery_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      sleep_hours REAL,
      sleep_quality INTEGER,
      stress_level INTEGER,
      resting_hr INTEGER,
      hrv INTEGER,
      soreness_chest INTEGER NOT NULL DEFAULT 0,
      soreness_back INTEGER NOT NULL DEFAULT 0,
      soreness_legs INTEGER NOT NULL DEFAULT 0,
      soreness_shoulders INTEGER NOT NULL DEFAULT 0,
      soreness_arms INTEGER NOT NULL DEFAULT 0,
      logged_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nutrition_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      calories INTEGER,
      protein_g REAL,
      water_ml INTEGER,
      pre_workout_meal INTEGER NOT NULL DEFAULT 0,
      post_workout_meal INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      logged_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS resolved_staleness (
      exercise_id INTEGER PRIMARY KEY REFERENCES exercises(id),
      resolved_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_goals (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      calorie_goal INTEGER NOT NULL DEFAULT 2400,
      protein_goal REAL NOT NULL DEFAULT 160,
      water_goal_ml INTEGER NOT NULL DEFAULT 3000,
      height_cm REAL NOT NULL DEFAULT 178
    );
    INSERT OR IGNORE INTO user_goals (id) VALUES (1);
  `)

  // rpe columns were added after initial release — backfill for existing DBs.
  const setCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(sets)`)
  if (!setCols.some((c) => c.name === 'rpe')) {
    await db.execAsync('ALTER TABLE sets ADD COLUMN rpe REAL')
  }
  const workoutCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(workouts)`)
  if (!workoutCols.some((c) => c.name === 'overall_rpe')) {
    await db.execAsync('ALTER TABLE workouts ADD COLUMN overall_rpe REAL')
  }
}
