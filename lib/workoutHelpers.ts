import {
  getExercisesByName,
  addWorkoutExercise,
  createWorkout,
  getPreviousSets,
} from './firestore/queries'
import type { WorkoutTemplate } from './templates'
import type { ActiveExercise } from './types'

export async function buildWorkoutFromTemplate(
  template: WorkoutTemplate
): Promise<{ workoutId: string; exercises: ActiveExercise[] }> {
  const dbExercises = await getExercisesByName(template.exercises.map((e) => e.name))
  const workoutId = await createWorkout(template.name)
  const exercises: ActiveExercise[] = []

  for (let i = 0; i < template.exercises.length; i++) {
    const tmpl = template.exercises[i]
    const ex = dbExercises.find((e) => e.name === tmpl.name)
    if (!ex) continue

    const workoutExerciseId = await addWorkoutExercise(workoutId, ex.id, i, ex.name)
    const prevSets = await getPreviousSets(ex.id)
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
