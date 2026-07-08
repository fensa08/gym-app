export interface WorkoutTemplate {
  name: string
  tag: string
  color: string
  exercises: { name: string; sets: number }[]
}

export const TEMPLATES: WorkoutTemplate[] = [
  {
    name: 'Push Day A',
    tag: 'Push',
    color: '#6C63FF',
    exercises: [
      { name: 'Bench Press', sets: 4 },
      { name: 'Incline DB Press', sets: 3 },
      { name: 'Overhead Press', sets: 3 },
      { name: 'Lateral Raises', sets: 3 },
      { name: 'Tricep Pushdown', sets: 3 },
    ],
  },
  {
    name: 'Pull Day A',
    tag: 'Pull',
    color: '#00D4A4',
    exercises: [
      { name: 'Deadlift', sets: 3 },
      { name: 'Pull-Ups', sets: 3 },
      { name: 'Barbell Row', sets: 3 },
      { name: 'Face Pulls', sets: 3 },
      { name: 'Barbell Curl', sets: 3 },
    ],
  },
  {
    name: 'Legs Day A',
    tag: 'Legs',
    color: '#FF6B35',
    exercises: [
      { name: 'Squat', sets: 4 },
      { name: 'Romanian Deadlift', sets: 3 },
      { name: 'Leg Press', sets: 3 },
      { name: 'Leg Curl', sets: 3 },
      { name: 'Calf Raises', sets: 4 },
    ],
  },
]
