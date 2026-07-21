import {
  collection, doc, getDoc, getDocs, setDoc,
  query, orderBy, limit, where,
} from 'firebase/firestore'
import { db, auth } from '../firebase'
import type {
  BodyWeightLog, BodyCompositionLog, BodyFatMethod,
  RecoveryLog, NutritionLog, UserGoals,
} from '../types'

function uid(): string {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.uid
}

const col = (name: string) => collection(db, 'users', uid(), name)
const ref = (name: string, id: string) => doc(db, 'users', uid(), name, id)

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Body weight ──────────────────────────────────────────────────
export async function upsertBodyWeightLog(
  weightKg: number,
  date = today(),
  notes: string | null = null
): Promise<void> {
  await setDoc(ref('body_weight_logs', date), { date, weight_kg: weightKg, notes, logged_at: Date.now() })
}

export async function getBodyWeightLogs(days = 30): Promise<BodyWeightLog[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const snap = await getDocs(
    query(col('body_weight_logs'), where('date', '>=', since.toISOString().slice(0, 10)), orderBy('date'))
  )
  return snap.docs.map((d, i) => ({ id: i, ...d.data() } as BodyWeightLog))
}

export async function getLatestBodyWeight(): Promise<BodyWeightLog | null> {
  const snap = await getDocs(query(col('body_weight_logs'), orderBy('date', 'desc'), limit(1)))
  if (snap.empty) return null
  return { id: 0, ...snap.docs[0].data() } as BodyWeightLog
}

export async function getDaysSinceLastMeasurement(): Promise<number | null> {
  const snap = await getDocs(query(col('body_composition_logs'), orderBy('date', 'desc'), limit(1)))
  if (snap.empty) return null
  const date = snap.docs[0].data().date as string
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

// ── Body composition ─────────────────────────────────────────────
export interface BodyCompositionInput {
  body_fat_pct?: number | null
  method?: BodyFatMethod | null
  neck_cm?: number | null
  height_cm?: number | null
  chest_cm?: number | null
  waist_cm?: number | null
  hips_cm?: number | null
  arms_cm?: number | null
  thighs_cm?: number | null
  calves_cm?: number | null
  photo_front?: string | null
  photo_side?: string | null
  photo_back?: string | null
}

export async function insertBodyCompositionLog(
  input: BodyCompositionInput,
  date = today()
): Promise<void> {
  const docRef = doc(col('body_composition_logs'))
  await setDoc(docRef, {
    date,
    body_fat_pct: input.body_fat_pct ?? null,
    method: input.method ?? null,
    neck_cm: input.neck_cm ?? null,
    height_cm: input.height_cm ?? null,
    chest_cm: input.chest_cm ?? null,
    waist_cm: input.waist_cm ?? null,
    hips_cm: input.hips_cm ?? null,
    arms_cm: input.arms_cm ?? null,
    thighs_cm: input.thighs_cm ?? null,
    calves_cm: input.calves_cm ?? null,
    photo_front: input.photo_front ?? null,
    photo_side: input.photo_side ?? null,
    photo_back: input.photo_back ?? null,
    logged_at: Date.now(),
  })
}

export async function getLatestBodyComposition(): Promise<BodyCompositionLog | null> {
  const snap = await getDocs(query(col('body_composition_logs'), orderBy('date', 'desc'), orderBy('logged_at', 'desc'), limit(1)))
  if (snap.empty) return null
  return { id: 0, ...snap.docs[0].data() } as BodyCompositionLog
}

export async function getBodyCompositionHistory(days = 60): Promise<BodyCompositionLog[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const snap = await getDocs(
    query(col('body_composition_logs'), where('date', '>=', since.toISOString().slice(0, 10)), orderBy('date'))
  )
  return snap.docs.map((d, i) => ({ id: i, ...d.data() } as BodyCompositionLog))
}

// ── Recovery ──────────────────────────────────────────────────────
export interface RecoveryInput {
  sleep_hours?: number | null
  sleep_quality?: number | null
  stress_level?: number | null
  resting_hr?: number | null
  hrv?: number | null
  soreness_chest?: number
  soreness_back?: number
  soreness_legs?: number
  soreness_shoulders?: number
  soreness_arms?: number
}

export async function upsertRecoveryLog(input: RecoveryInput, date = today()): Promise<void> {
  await setDoc(ref('recovery_logs', date), {
    date,
    sleep_hours: input.sleep_hours ?? null,
    sleep_quality: input.sleep_quality ?? null,
    stress_level: input.stress_level ?? null,
    resting_hr: input.resting_hr ?? null,
    hrv: input.hrv ?? null,
    soreness_chest: input.soreness_chest ?? 0,
    soreness_back: input.soreness_back ?? 0,
    soreness_legs: input.soreness_legs ?? 0,
    soreness_shoulders: input.soreness_shoulders ?? 0,
    soreness_arms: input.soreness_arms ?? 0,
    logged_at: Date.now(),
  })
}

export async function getLatestRecoveryLog(): Promise<RecoveryLog | null> {
  const snap = await getDocs(query(col('recovery_logs'), orderBy('date', 'desc'), limit(1)))
  if (snap.empty) return null
  return { id: 0, ...snap.docs[0].data() } as RecoveryLog
}

export async function getRecoveryLogs(days = 7): Promise<RecoveryLog[]> {
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const snap = await getDocs(
    query(col('recovery_logs'), where('date', '>=', since.toISOString().slice(0, 10)), orderBy('date'))
  )
  return snap.docs.map((d, i) => ({ id: i, ...d.data() } as RecoveryLog))
}

export function readinessScore(log: Pick<RecoveryLog, 'sleep_hours' | 'hrv' | 'resting_hr'> | null): number | null {
  if (!log) return null
  const parts: number[] = []
  if (log.sleep_hours != null) parts.push(Math.max(0, Math.min(10, (log.sleep_hours / 8) * 10)))
  if (log.hrv != null) parts.push(Math.max(0, Math.min(10, (log.hrv / 65) * 10)))
  if (log.resting_hr != null) parts.push(Math.max(0, Math.min(10, 10 - (log.resting_hr - 50) / 4)))
  if (parts.length === 0) return null
  return Math.round((parts.reduce((s, v) => s + v, 0) / parts.length) * 10) / 10
}

// ── Nutrition ─────────────────────────────────────────────────────
export interface NutritionInput {
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  water_ml?: number | null
  pre_workout_meal?: boolean
  post_workout_meal?: boolean
  notes?: string | null
}

export async function upsertNutritionLog(input: NutritionInput, date = today()): Promise<void> {
  await setDoc(ref('nutrition_logs', date), {
    date,
    calories: input.calories ?? null,
    protein_g: input.protein_g ?? null,
    carbs_g: input.carbs_g ?? null,
    fat_g: input.fat_g ?? null,
    water_ml: input.water_ml ?? null,
    pre_workout_meal: input.pre_workout_meal ? 1 : 0,
    post_workout_meal: input.post_workout_meal ? 1 : 0,
    notes: input.notes ?? null,
    logged_at: Date.now(),
  })
}

export async function getTodayNutritionLog(): Promise<NutritionLog | null> {
  const snap = await getDoc(ref('nutrition_logs', today()))
  if (!snap.exists()) return null
  return { id: 0, ...snap.data() } as NutritionLog
}

export async function getNutritionLogs(days = 7): Promise<NutritionLog[]> {
  const since = new Date()
  since.setDate(since.getDate() - (days - 1))
  const snap = await getDocs(
    query(col('nutrition_logs'), where('date', '>=', since.toISOString().slice(0, 10)), orderBy('date'))
  )
  return snap.docs.map((d, i) => ({ id: i, ...d.data() } as NutritionLog))
}

export async function getNutritionStreaks(
  calorieGoal: number
): Promise<{ surplusStreak: number; deficitStreak: number }> {
  const snap = await getDocs(query(col('nutrition_logs'), orderBy('date', 'desc'), limit(60)))
  const rows = snap.docs.map(d => d.data() as { date: string; calories: number | null })
  let surplusStreak = 0, deficitStreak = 0
  for (const row of rows) {
    if (row.calories == null) break
    if (row.calories > calorieGoal) {
      if (deficitStreak > 0) break
      surplusStreak++
    } else {
      if (surplusStreak > 0) break
      deficitStreak++
    }
  }
  return { surplusStreak, deficitStreak }
}

// ── Goals / settings ─────────────────────────────────────────────
const GOALS_DEFAULTS: UserGoals = {
  id: 1,
  calorie_goal: 2400,
  protein_goal: 160,
  carbs_goal: 250,
  fat_goal: 75,
  water_goal_ml: 3000,
  height_cm: 178,
  weight_goal_kg: null,
}

export async function getUserGoals(): Promise<UserGoals> {
  const snap = await getDoc(ref('settings', 'goals'))
  if (!snap.exists()) return GOALS_DEFAULTS
  return { ...GOALS_DEFAULTS, id: 1, ...snap.data() } as UserGoals
}

export async function updateUserGoals(goals: Partial<Omit<UserGoals, 'id'>>): Promise<void> {
  const current = await getUserGoals()
  const merged = { ...current, ...goals }
  await setDoc(ref('settings', 'goals'), {
    calorie_goal: merged.calorie_goal,
    protein_goal: merged.protein_goal,
    carbs_goal: merged.carbs_goal,
    fat_goal: merged.fat_goal,
    water_goal_ml: merged.water_goal_ml,
    height_cm: merged.height_cm,
    weight_goal_kg: merged.weight_goal_kg ?? null,
  })
}

export async function getNutritionAverages(days = 7): Promise<{
  avgCalories: number | null
  avgProtein: number | null
  avgCarbs: number | null
  avgFat: number | null
  daysLogged: number
}> {
  const logs = await getNutritionLogs(days)
  const withCal = logs.filter(l => l.calories != null)
  if (withCal.length === 0) return { avgCalories: null, avgProtein: null, avgCarbs: null, avgFat: null, daysLogged: 0 }
  const avg = (arr: (number | null)[]) => {
    const valid = arr.filter((v): v is number => v != null)
    return valid.length ? valid.reduce((s, v) => s + v, 0) / valid.length : null
  }
  return {
    avgCalories: avg(withCal.map(l => l.calories)),
    avgProtein: avg(withCal.map(l => l.protein_g)),
    avgCarbs: avg(withCal.map(l => l.carbs_g)),
    avgFat: avg(withCal.map(l => l.fat_g)),
    daysLogged: withCal.length,
  }
}

export async function getPreviousBodyComposition(): Promise<BodyCompositionLog | null> {
  const snap = await getDocs(query(col('body_composition_logs'), orderBy('date', 'desc'), orderBy('logged_at', 'desc'), limit(2)))
  if (snap.docs.length < 2) return null
  return { id: 0, ...snap.docs[1].data() } as BodyCompositionLog
}

// ── Staleness detection ───────────────────────────────────────────
export async function getStaleExercises(
  staleDays = 21
): Promise<{ exercise_id: string; exercise_name: string; days_since_pr: number }[]> {
  const snap = await getDocs(
    query(collection(db, 'users', uid(), 'workouts'), where('finished_at', '>', 0), orderBy('finished_at', 'desc'))
  )
  const latestPR = new Map<string, { name: string; at: number }>()
  for (const d of snap.docs) {
    for (const ex of (d.data().exercises || [])) {
      for (const s of (ex.sets || [])) {
        if (s.is_pr && s.completed_at) {
          const prev = latestPR.get(ex.exerciseId)
          if (!prev || s.completed_at > prev.at) {
            latestPR.set(ex.exerciseId, { name: ex.exercise_name || ex.exerciseId, at: s.completed_at })
          }
        }
      }
    }
  }
  const resolvedSnap = await getDocs(col('resolved_staleness'))
  const resolved = new Set(resolvedSnap.docs.map(d => d.id))
  const cutoff = staleDays * 86400000
  return Array.from(latestPR.entries())
    .filter(([id, { at }]) => !resolved.has(id) && Date.now() - at > cutoff)
    .map(([id, { name, at }]) => ({
      exercise_id: id,
      exercise_name: name,
      days_since_pr: Math.floor((Date.now() - at) / 86400000),
    }))
    .sort((a, b) => b.days_since_pr - a.days_since_pr)
}

export async function markStalenessResolved(exerciseId: string): Promise<void> {
  await setDoc(ref('resolved_staleness', exerciseId), { resolved_at: Date.now() })
}

// ── Calorie calibration ───────────────────────────────────────────
export async function getMaintenanceCalibration(): Promise<{
  avgIntake: number; weightChangePerWeek: number; daysLogged: number
} | null> {
  const since = new Date()
  since.setDate(since.getDate() - 14)
  const sinceStr = since.toISOString().slice(0, 10)

  const [nutSnap, weightSnap] = await Promise.all([
    getDocs(query(col('nutrition_logs'), where('date', '>=', sinceStr), orderBy('date'))),
    getDocs(query(col('body_weight_logs'), where('date', '>=', sinceStr), orderBy('date'))),
  ])

  const nutritionRows = nutSnap.docs.map(d => d.data() as { calories: number | null })
    .filter(r => r.calories != null)
  if (nutritionRows.length < 14) return null

  const avgIntake = nutritionRows.reduce((s, r) => s + r.calories!, 0) / nutritionRows.length
  const weightRows = weightSnap.docs.map(d => d.data() as { date: string; weight_kg: number })

  let weightChangePerWeek = 0
  if (weightRows.length >= 2) {
    const first = weightRows[0], last = weightRows[weightRows.length - 1]
    const days = Math.max(1, (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000)
    weightChangePerWeek = ((last.weight_kg - first.weight_kg) / days) * 7
  }
  return { avgIntake, weightChangePerWeek, daysLogged: nutritionRows.length }
}
