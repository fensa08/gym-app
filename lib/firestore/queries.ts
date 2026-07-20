import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, limit, where, setDoc,
} from 'firebase/firestore'
import { db, auth } from '../firebase'
import type { Exercise, Workout } from '../types'

function uid(): string {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.uid
}

const col = (name: string) => collection(db, 'users', uid(), name)
const ref = (name: string, id: string) => doc(db, 'users', uid(), name, id)

// ── Exercises ────────────────────────────────────────────────────
export async function getAllExercises(): Promise<Exercise[]> {
  const snap = await getDocs(query(col('exercises'), orderBy('muscle_group'), orderBy('name')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Exercise))
}

export async function searchExercises(q: string): Promise<Exercise[]> {
  const all = await getAllExercises()
  const lower = q.toLowerCase()
  return all.filter(e =>
    e.name.toLowerCase().includes(lower) || e.muscle_group.toLowerCase().includes(lower)
  )
}

export async function getExercisesByName(names: string[]): Promise<Exercise[]> {
  if (names.length === 0) return []
  const snaps = await Promise.all(names.map(n => getDoc(ref('exercises', n))))
  return snaps.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() } as Exercise))
}

export async function getOrCreateExercise(
  name: string,
  muscleGroup = 'Custom',
  equipment = 'Custom'
): Promise<Exercise> {
  const docRef = ref('exercises', name)
  const snap = await getDoc(docRef)
  if (snap.exists()) return { id: snap.id, ...snap.data() } as Exercise
  const data = { name, muscle_group: muscleGroup, equipment }
  await setDoc(docRef, data)
  return { id: name, ...data }
}

// ── Workouts ─────────────────────────────────────────────────────
export async function createWorkout(name: string): Promise<string> {
  const docRef = await addDoc(col('workouts'), {
    name,
    started_at: Date.now(),
    finished_at: null,
    notes: null,
    overall_rpe: null,
    exercises: [],
  })
  return docRef.id
}

export async function finishWorkout(workoutId: string): Promise<void> {
  await updateDoc(ref('workouts', workoutId), { finished_at: Date.now() })
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  await deleteDoc(ref('workouts', workoutId))
}

export async function addWorkoutExercise(
  workoutId: string,
  exerciseId: string,
  orderIndex: number,
  exerciseName = ''
): Promise<string> {
  const workoutExerciseId = `${exerciseId}_${orderIndex}_${Date.now()}`
  const docRef = ref('workouts', workoutId)
  const snap = await getDoc(docRef)
  if (!snap.exists()) return workoutExerciseId
  const exercises = [...(snap.data().exercises || []), {
    workoutExerciseId,
    exerciseId,
    exercise_name: exerciseName,
    order_index: orderIndex,
    sets: [],
  }]
  await updateDoc(docRef, { exercises })
  return workoutExerciseId
}

export async function saveSet(
  workoutId: string,
  workoutExerciseId: string,
  setNumber: number,
  weightKg: number | null,
  reps: number | null,
  isPR: boolean
): Promise<string> {
  const docRef = ref('workouts', workoutId)
  const snap = await getDoc(docRef)
  if (!snap.exists()) return ''
  const exercises = (snap.data().exercises || []).map((ex: any) => {
    if (ex.workoutExerciseId !== workoutExerciseId) return ex
    const setId = `${workoutExerciseId}_s${setNumber}`
    return {
      ...ex,
      sets: [...(ex.sets || []), {
        id: setId,
        set_number: setNumber,
        weight_kg: weightKg,
        reps,
        completed: true,
        is_pr: isPR,
        rpe: null,
        completed_at: Date.now(),
      }],
    }
  })
  await updateDoc(docRef, { exercises })
  return `${workoutExerciseId}_s${setNumber}`
}

export async function getPreviousSets(
  exerciseId: string
): Promise<{ weight_kg: number | null; reps: number | null }[]> {
  const snap = await getDocs(
    query(col('workouts'), where('finished_at', '>', 0), orderBy('finished_at', 'desc'), limit(20))
  )
  for (const d of snap.docs) {
    const ex = (d.data().exercises || []).find((e: any) => e.exerciseId === exerciseId)
    if (ex?.sets?.length > 0) {
      return ex.sets.slice(0, 6).map((s: any) => ({ weight_kg: s.weight_kg, reps: s.reps }))
    }
  }
  return []
}

export async function getPersonalRecord(
  exerciseId: string
): Promise<{ weight_kg: number; reps: number } | null> {
  const snap = await getDocs(
    query(col('workouts'), where('finished_at', '>', 0), orderBy('finished_at', 'desc'))
  )
  let best: { weight_kg: number; reps: number } | null = null
  for (const d of snap.docs) {
    const ex = (d.data().exercises || []).find((e: any) => e.exerciseId === exerciseId)
    if (!ex) continue
    for (const s of (ex.sets || [])) {
      if (s.weight_kg != null && (!best || s.weight_kg > best.weight_kg)) {
        best = { weight_kg: s.weight_kg, reps: s.reps }
      }
    }
  }
  return best
}

export async function getRecentWorkouts(limitN = 10): Promise<Workout[]> {
  const snap = await getDocs(
    query(col('workouts'), where('finished_at', '>', 0), orderBy('finished_at', 'desc'), limit(limitN))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Workout))
}

export async function getWorkoutStats(
  workoutId: string
): Promise<{ exercise_count: number; set_count: number; volume: number } | null> {
  const snap = await getDoc(ref('workouts', workoutId))
  if (!snap.exists()) return null
  const exercises = snap.data().exercises || []
  let set_count = 0, volume = 0
  for (const ex of exercises) {
    for (const s of (ex.sets || [])) {
      if (s.completed) {
        set_count++
        if (s.weight_kg != null && s.reps != null) volume += s.weight_kg * s.reps
      }
    }
  }
  return { exercise_count: exercises.length, set_count, volume }
}

export async function getWeeklyVolume(): Promise<{ day: string; volume: number }[]> {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000
  const snap = await getDocs(
    query(col('workouts'), where('started_at', '>=', since), orderBy('started_at'))
  )
  const byDay = new Map<string, number>()
  for (const d of snap.docs) {
    const data = d.data()
    const day = new Date(data.started_at).toISOString().slice(0, 10)
    let vol = byDay.get(day) ?? 0
    for (const ex of (data.exercises || [])) {
      for (const s of (ex.sets || [])) {
        if (s.completed && s.weight_kg != null && s.reps != null) vol += s.weight_kg * s.reps
      }
    }
    byDay.set(day, vol)
  }
  return Array.from(byDay.entries())
    .map(([day, volume]) => ({ day, volume }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

export async function getAllPRs(): Promise<
  { exercise_name: string; weight_kg: number; reps: number; completed_at: number }[]
> {
  const snap = await getDocs(
    query(col('workouts'), where('finished_at', '>', 0), orderBy('finished_at', 'desc'))
  )
  const best = new Map<string, { exercise_name: string; weight_kg: number; reps: number; completed_at: number }>()
  for (const d of snap.docs) {
    for (const ex of (d.data().exercises || [])) {
      for (const s of (ex.sets || [])) {
        if (s.is_pr && s.weight_kg != null) {
          const prev = best.get(ex.exerciseId)
          if (!prev || s.weight_kg > prev.weight_kg) {
            best.set(ex.exerciseId, {
              exercise_name: ex.exercise_name || ex.exerciseId,
              weight_kg: s.weight_kg,
              reps: s.reps,
              completed_at: s.completed_at,
            })
          }
        }
      }
    }
  }
  return Array.from(best.values()).sort((a, b) => b.completed_at - a.completed_at)
}

export async function getWorkoutHistoryWithStats(limitN = 30) {
  const snap = await getDocs(
    query(col('workouts'), where('finished_at', '>', 0), orderBy('finished_at', 'desc'), limit(limitN))
  )
  return snap.docs.map(d => {
    const data = d.data()
    const exercises = data.exercises || []
    let set_count = 0, volume = 0
    for (const ex of exercises) {
      for (const s of (ex.sets || [])) {
        if (s.completed) {
          set_count++
          if (s.weight_kg != null && s.reps != null) volume += s.weight_kg * s.reps
        }
      }
    }
    return { id: d.id, name: data.name, started_at: data.started_at, finished_at: data.finished_at, exercise_count: exercises.length, set_count, volume }
  })
}

export async function getMonthlyVolume(): Promise<number> {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const snap = await getDocs(
    query(col('workouts'), where('started_at', '>=', monthStart.getTime()), orderBy('started_at'))
  )
  let volume = 0
  for (const d of snap.docs) {
    for (const ex of (d.data().exercises || [])) {
      for (const s of (ex.sets || [])) {
        if (s.completed && s.weight_kg != null && s.reps != null) volume += s.weight_kg * s.reps
      }
    }
  }
  return volume
}

export async function getWorkoutStreak(): Promise<number> {
  const snap = await getDocs(
    query(col('workouts'), where('finished_at', '>', 0), orderBy('finished_at', 'desc'))
  )
  if (snap.empty) return 0
  const days = new Set(
    snap.docs.map(d => new Date(d.data().finished_at).toISOString().slice(0, 10))
  )
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const cursor = new Date()
  if (!days.has(fmt(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(fmt(cursor))) return 0
  }
  let streak = 0
  while (days.has(fmt(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export async function setWorkoutRpe(workoutId: string, rpe: number): Promise<void> {
  await updateDoc(ref('workouts', workoutId), { overall_rpe: rpe })
}

export async function setExerciseRpe(workoutId: string, workoutExerciseId: string, rpe: number): Promise<void> {
  const docRef = ref('workouts', workoutId)
  const snap = await getDoc(docRef)
  if (!snap.exists()) return
  const exercises = (snap.data().exercises || []).map((ex: any) =>
    ex.workoutExerciseId === workoutExerciseId ? { ...ex, rpe } : ex
  )
  await updateDoc(docRef, { exercises })
}
