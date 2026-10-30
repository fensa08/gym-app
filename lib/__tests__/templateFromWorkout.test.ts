jest.mock('../firestore/queries', () => ({}))
import { templateFromWorkout } from '../workoutHelpers'

test('maps names and set counts, keeps name', () => {
  const t = templateFromWorkout({ id: 'w1', name: 'Push Day', exercises: [
    { workoutExerciseId: 'a', exercise_name: 'Bench Press', sets: [{}, {}, {}] as any },
    { workoutExerciseId: 'b', exercise_name: 'Dips', sets: [{}] as any },
  ] })
  expect(t.name).toBe('Push Day')
  expect(t.exercises).toEqual([{ name: 'Bench Press', sets: 3 }, { name: 'Dips', sets: 1 }])
})
