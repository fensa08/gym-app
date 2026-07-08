import { colors } from './theme'

export interface WorkoutTemplate {
  key: string
  name: string
  tag: string
  sub: string
  duration: number
  iconColor: string
  iconBg: string
  color: string
  exercises: { name: string; sets: number }[]
}

export const TEMPLATES: WorkoutTemplate[] = [
  {
    key: 'push',
    name: 'Push Day',
    tag: 'Push',
    sub: 'Chest, Shoulders & Triceps',
    duration: 58,
    iconColor: colors.accentDark,
    iconBg: colors.surfaceGreen,
    color: colors.accentDark,
    exercises: [
      { name: 'Bench Press', sets: 4 },
      { name: 'Incline DB Press', sets: 3 },
      { name: 'Overhead Press', sets: 3 },
      { name: 'Lateral Raises', sets: 3 },
      { name: 'Tricep Pushdown', sets: 3 },
      { name: 'Dips', sets: 3 },
    ],
  },
  {
    key: 'pull',
    name: 'Pull Day',
    tag: 'Pull',
    sub: 'Back & Biceps',
    duration: 55,
    iconColor: colors.accentMid,
    iconBg: colors.surfaceMint,
    color: colors.accentMid,
    exercises: [
      { name: 'Deadlift', sets: 4 },
      { name: 'Pull-Ups', sets: 4 },
      { name: 'Barbell Row', sets: 3 },
      { name: 'Lat Pulldown', sets: 3 },
      { name: 'Barbell Curl', sets: 3 },
      { name: 'Face Pulls', sets: 3 },
    ],
  },
  {
    key: 'legs',
    name: 'Leg Day',
    tag: 'Legs',
    sub: 'Quads, Hamstrings & Glutes',
    duration: 65,
    iconColor: colors.accentDark,
    iconBg: colors.surfaceGreen,
    color: colors.accentDark,
    exercises: [
      { name: 'Squat', sets: 4 },
      { name: 'Romanian Deadlift', sets: 3 },
      { name: 'Leg Press', sets: 3 },
      { name: 'Walking Lunge', sets: 3 },
      { name: 'Leg Curl', sets: 3 },
      { name: 'Calf Raises', sets: 4 },
    ],
  },
  {
    key: 'upper',
    name: 'Upper Body',
    tag: 'Upper',
    sub: 'Full Upper Session',
    duration: 50,
    iconColor: colors.accentMid,
    iconBg: colors.surfaceMint,
    color: colors.accentMid,
    exercises: [
      { name: 'Incline Barbell Press', sets: 4 },
      { name: 'Seated Cable Row', sets: 3 },
      { name: 'Arnold Press', sets: 3 },
      { name: 'Chin-Ups', sets: 3 },
      { name: 'EZ-Bar Curl', sets: 3 },
    ],
  },
]
