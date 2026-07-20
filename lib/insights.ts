import {
  getBodyWeightLogs,
  getBodyCompositionHistory,
  getRecoveryLogs,
  readinessScore,
  getStaleExercises,
  getMaintenanceCalibration,
  getUserGoals,
} from './firestore/queriesHealth'

export type SignalColor = 'green' | 'amber' | 'red' | 'blue'

export const SIGNAL_COLORS: Record<SignalColor, string> = {
  green: '#3f8f5c',
  amber: '#c98a2e',
  red: '#e0575c',
  blue: '#3d6fb0',
}

export function computeFFMI(weightKg: number, bfPct: number, heightCm: number): number {
  const heightM = heightCm / 100
  const leanMassKg = weightKg * (1 - bfPct / 100)
  return leanMassKg / (heightM * heightM) + 6.1 * (1.8 - heightM)
}

export interface Signal {
  key: string
  title: string
  headline: string
  color: SignalColor
  chips: { label: string; value: string }[]
  recommendation?: string
}

export async function getBodyCompositionSignal(): Promise<Signal | null> {
  const weights = await getBodyWeightLogs(30)
  const comps = await getBodyCompositionHistory(30)
  if (weights.length < 2) return null
  const weightChange = weights[weights.length - 1].weight_kg - weights[0].weight_kg
  const bfComps = comps.filter((c) => c.body_fat_pct != null)
  const bfChange = bfComps.length >= 2 ? bfComps[bfComps.length - 1].body_fat_pct! - bfComps[0].body_fat_pct! : null

  let color: SignalColor = 'blue'
  let headline = 'Cutting steadily'
  if (weightChange > 0.2) {
    if (bfChange != null && bfChange > 1) { color = 'amber'; headline = 'Gaining fat faster than muscle' }
    else { color = 'green'; headline = 'Gaining muscle cleanly' }
  } else if (weightChange < -0.2) {
    color = 'blue'; headline = 'Cutting steadily'
  } else {
    color = 'green'; headline = 'Weight holding steady'
  }

  return {
    key: 'body_composition',
    title: 'Body Composition Signal',
    headline,
    color,
    chips: [
      { label: 'Weight change', value: `${weightChange >= 0 ? '+' : ''}${weightChange.toFixed(1)} kg` },
      { label: 'BF% change', value: bfChange != null ? `${bfChange >= 0 ? '+' : ''}${bfChange.toFixed(1)}%` : '—' },
    ],
  }
}

export async function getReadinessSignal(): Promise<Signal | null> {
  const logs = await getRecoveryLogs(7)
  if (logs.length === 0) return null
  const latest = logs[logs.length - 1]
  const score = readinessScore(latest)
  if (score == null) return null
  const color: SignalColor = score >= 7 ? 'green' : score >= 5 ? 'amber' : 'red'
  const headline = score >= 7 ? 'Ready to train hard' : score >= 5 ? 'Train, but ease intensity' : 'Recovery flagged — consider deload'
  return {
    key: 'readiness',
    title: "Today's Readiness",
    headline,
    color,
    chips: [
      { label: 'Sleep', value: latest.sleep_hours != null ? `${latest.sleep_hours}h` : '—' },
      { label: 'HRV', value: latest.hrv != null ? `${latest.hrv}ms` : '—' },
      { label: 'Resting HR', value: latest.resting_hr != null ? `${latest.resting_hr}bpm` : '—' },
    ],
    recommendation: score < 5 ? 'Consider a lighter session or an extra rest day today.' : undefined,
  }
}

export async function getBulkQualitySignal(): Promise<Signal | null> {
  const weights = await getBodyWeightLogs(21)
  const comps = await getBodyCompositionHistory(21)
  if (weights.length < 4) return null
  const first = weights[0], last = weights[weights.length - 1]
  const days = Math.max(1, (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000)
  const gainRate = ((last.weight_kg - first.weight_kg) / days) * 7
  const waistComps = comps.filter((c) => c.waist_cm != null)
  const waistChange = waistComps.length >= 2 ? waistComps[waistComps.length - 1].waist_cm! - waistComps[0].waist_cm! : null
  if (gainRate <= 0) return null
  const clean = waistChange == null || waistChange < 1
  return {
    key: 'bulk_quality',
    title: 'Bulk Quality',
    headline: clean ? 'Clean bulk — on track' : 'Dirty bulk — waist rising fast',
    color: clean ? 'green' : 'amber',
    chips: [
      { label: 'Weight gain rate', value: `${gainRate.toFixed(2)} kg/wk` },
      { label: 'Waist change', value: waistChange != null ? `${waistChange >= 0 ? '+' : ''}${waistChange.toFixed(1)}cm` : '—' },
    ],
    recommendation: clean ? undefined : 'Trim ~150–200 kcal/day to slow fat gain while preserving muscle gain.',
  }
}

export async function getStalenessSignal() {
  return getStaleExercises()
}

export async function getCalibrationSignal(): Promise<Signal | null> {
  const calib = await getMaintenanceCalibration()
  if (!calib) return null
  const goals = await getUserGoals()
  const estimatedMaintenance = Math.round(calib.avgIntake - (calib.weightChangePerWeek * 1100) / 7)
  return {
    key: 'calibration',
    title: 'Calorie Calibration',
    headline: `Estimated maintenance: ${estimatedMaintenance} kcal`,
    color: 'blue',
    chips: [
      { label: 'Avg intake', value: `${Math.round(calib.avgIntake)} kcal` },
      { label: 'Weight trend', value: `${calib.weightChangePerWeek >= 0 ? '+' : ''}${calib.weightChangePerWeek.toFixed(2)} kg/wk` },
      { label: 'vs goal', value: `${goals.calorie_goal} kcal` },
    ],
  }
}

export async function getTopInsight(): Promise<{ headline: string; color: SignalColor } | null> {
  const readiness = await getReadinessSignal()
  if (readiness && (readiness.color === 'red' || readiness.color === 'amber')) {
    return { headline: readiness.headline, color: readiness.color }
  }
  const bulk = await getBulkQualitySignal()
  if (bulk) return { headline: bulk.headline, color: bulk.color }
  const body = await getBodyCompositionSignal()
  if (body) return { headline: body.headline, color: body.color }
  if (readiness) return { headline: readiness.headline, color: readiness.color }
  return null
}
