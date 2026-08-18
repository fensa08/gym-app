import { collection, doc, getDocs, addDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore'
import { db, auth } from '../firebase'
import type { RunLog } from '../types'

function uid(): string {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.uid
}

const col = () => collection(db, 'users', uid(), 'runs')
const ref = (id: string) => doc(db, 'users', uid(), 'runs', id)

// ── Runs ─────────────────────────────────────────────────────────
export async function saveRun(
  startedAt: number,
  durationS: number,
  distanceKm: number,
  avgHeartRate: number | null,
  notes: string | null = null
): Promise<string> {
  const avgPaceSPerKm = distanceKm > 0 ? durationS / distanceKm : null
  const docRef = await addDoc(col(), {
    started_at: startedAt,
    duration_s: durationS,
    distance_km: distanceKm,
    avg_pace_s_per_km: avgPaceSPerKm,
    avg_heart_rate: avgHeartRate,
    notes,
  })
  return docRef.id
}

export async function getRecentRuns(limitN = 20): Promise<RunLog[]> {
  const snap = await getDocs(query(col(), orderBy('started_at', 'desc'), limit(limitN)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as RunLog))
}

export async function deleteRun(runId: string): Promise<void> {
  await deleteDoc(ref(runId))
}
