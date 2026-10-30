import {
  getExercisesByName,
  addWorkoutExercise,
  createWorkout,
  getPreviousSets,
} from './firestore/queries'
import { colors } from './theme'
import type { WorkoutDetail } from './firestore/queries'
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
      previousSets: prevSets,
    })
  }

  return { workoutId, exercises }
}

// Template from a past workout: same name + exercise names, same set count as the target.
export function templateFromWorkout(w: Pick<WorkoutDetail, 'id' | 'name' | 'exercises'>): WorkoutTemplate {
  return {
    key: w.id, name: w.name, tag: 'Repeat', sub: `${w.exercises.length} exercises`,
    duration: w.exercises.length * 8,
    iconColor: colors.accentMid, iconBg: colors.surfaceMint, color: colors.accentMid,
    exercises: w.exercises.map((e) => ({ name: e.exercise_name, sets: e.sets.length })),
  }
}
