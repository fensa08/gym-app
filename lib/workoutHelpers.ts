import type { SQLiteDatabase } from 'expo-sqlite'
import {
  getExercisesByName,
  addWorkoutExercise,
  createWorkout,
  getPreviousSets,
} from './db/queries'
import type { WorkoutTemplate } from './templates'
import type { ActiveExercise } from './types'

export async function buildWorkoutFromTemplate(
  db: SQLiteDatabase,
  template: WorkoutTemplate
): Promise<{ workoutId: number; exercises: ActiveExercise[] }> {
  const dbExercises = await getExercisesByName(db, template.exercises.map((e) => e.name))
  const workoutId = await createWorkout(db, template.name)
  const exercises: ActiveExercise[] = []

  for (let i = 0; i < template.exercises.length; i++) {
    const tmpl = template.exercises[i]
    const ex = dbExercises.find((e) => e.name === tmpl.name)
    if (!ex) continue

    const workoutExerciseId = await addWorkoutExercise(db, workoutId, ex.id, i)
    const prevSets = await getPreviousSets(db, ex.id)
    const last = prevSets[0]

    exercises.push({
      workoutExerciseId,
      exerciseId: ex.id,
      name: ex.name,
      muscleGroup: ex.muscle_group,
      equipment: ex.equipment,
      target: `${tmpl.sets} sets × reps`,
      startReps: last?.reps ?? 8,
      startKg: last?.weight_kg ?? 20,
      loggedSets: [],
    })
  }

  return { workoutId, exercises }
}
