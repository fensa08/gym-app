import type { SQLiteDatabase } from 'expo-sqlite'

const EXERCISES = [
  { name: 'Bench Press', muscle_group: 'Chest', equipment: 'Barbell' },
  { name: 'Incline DB Press', muscle_group: 'Chest', equipment: 'Dumbbell' },
  { name: 'Incline Barbell Press', muscle_group: 'Chest', equipment: 'Barbell' },
  { name: 'Decline Bench Press', muscle_group: 'Chest', equipment: 'Barbell' },
  { name: 'Cable Fly', muscle_group: 'Chest', equipment: 'Cable' },
  { name: 'Dips', muscle_group: 'Chest', equipment: 'Bodyweight' },
  { name: 'Push-Ups', muscle_group: 'Chest', equipment: 'Bodyweight' },

  { name: 'Deadlift', muscle_group: 'Back', equipment: 'Barbell' },
  { name: 'Pull-Ups', muscle_group: 'Back', equipment: 'Bodyweight' },
  { name: 'Chin-Ups', muscle_group: 'Back', equipment: 'Bodyweight' },
  { name: 'Barbell Row', muscle_group: 'Back', equipment: 'Barbell' },
  { name: 'Lat Pulldown', muscle_group: 'Back', equipment: 'Cable' },
  { name: 'Seated Cable Row', muscle_group: 'Back', equipment: 'Cable' },
  { name: 'Face Pulls', muscle_group: 'Back', equipment: 'Cable' },
  { name: 'T-Bar Row', muscle_group: 'Back', equipment: 'Barbell' },

  { name: 'Squat', muscle_group: 'Legs', equipment: 'Barbell' },
  { name: 'Romanian Deadlift', muscle_group: 'Legs', equipment: 'Barbell' },
  { name: 'Leg Press', muscle_group: 'Legs', equipment: 'Machine' },
  { name: 'Lunges', muscle_group: 'Legs', equipment: 'Dumbbell' },
  { name: 'Walking Lunge', muscle_group: 'Legs', equipment: 'Dumbbell' },
  { name: 'Leg Curl', muscle_group: 'Legs', equipment: 'Machine' },
  { name: 'Leg Extension', muscle_group: 'Legs', equipment: 'Machine' },
  { name: 'Calf Raises', muscle_group: 'Legs', equipment: 'Machine' },
  { name: 'Hack Squat', muscle_group: 'Legs', equipment: 'Machine' },

  { name: 'Overhead Press', muscle_group: 'Shoulders', equipment: 'Barbell' },
  { name: 'Arnold Press', muscle_group: 'Shoulders', equipment: 'Dumbbell' },
  { name: 'Lateral Raises', muscle_group: 'Shoulders', equipment: 'Dumbbell' },
  { name: 'Front Raises', muscle_group: 'Shoulders', equipment: 'Dumbbell' },
  { name: 'Rear Delt Fly', muscle_group: 'Shoulders', equipment: 'Dumbbell' },

  { name: 'Barbell Curl', muscle_group: 'Biceps', equipment: 'Barbell' },
  { name: 'Dumbbell Curl', muscle_group: 'Biceps', equipment: 'Dumbbell' },
  { name: 'Hammer Curl', muscle_group: 'Biceps', equipment: 'Dumbbell' },
  { name: 'Cable Curl', muscle_group: 'Biceps', equipment: 'Cable' },
  { name: 'Preacher Curl', muscle_group: 'Biceps', equipment: 'Barbell' },
  { name: 'EZ-Bar Curl', muscle_group: 'Biceps', equipment: 'Barbell' },

  { name: 'Skull Crushers', muscle_group: 'Triceps', equipment: 'Barbell' },
  { name: 'Tricep Pushdown', muscle_group: 'Triceps', equipment: 'Cable' },
  { name: 'Close Grip Bench', muscle_group: 'Triceps', equipment: 'Barbell' },
  { name: 'Overhead Tricep Extension', muscle_group: 'Triceps', equipment: 'Dumbbell' },

  { name: 'Plank', muscle_group: 'Core', equipment: 'Bodyweight' },
  { name: 'Cable Crunch', muscle_group: 'Core', equipment: 'Cable' },
  { name: 'Leg Raises', muscle_group: 'Core', equipment: 'Bodyweight' },
  { name: 'Ab Wheel', muscle_group: 'Core', equipment: 'Equipment' },
]

export async function seedExercises(db: SQLiteDatabase) {
  const existing = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM exercises')
  if (existing && existing.count > 0) return

  for (const ex of EXERCISES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO exercises (name, muscle_group, equipment) VALUES (?, ?, ?)',
      [ex.name, ex.muscle_group, ex.equipment]
    )
  }
}
