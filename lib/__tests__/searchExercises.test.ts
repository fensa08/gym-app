const getDocs = jest.fn()
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), doc: jest.fn(() => ({ id: 'X' })), getDoc: jest.fn(() => Promise.resolve({ exists: () => false })), getDocs: (...a: unknown[]) => getDocs(...a),
  addDoc: jest.fn(), updateDoc: jest.fn(), deleteDoc: jest.fn(), query: jest.fn(),
  orderBy: jest.fn(), limit: jest.fn(), where: jest.fn(), setDoc: jest.fn(() => Promise.resolve()),
}))
jest.mock('../firebase', () => ({ db: {}, auth: { currentUser: { uid: 'u1' } } }))

import { searchExercises, getOrCreateExercise } from '../firestore/queries'

const mk = (name: string, muscle_group = 'Chest') => ({ id: name, data: () => ({ name, muscle_group }) })

describe('searchExercises', () => {
  beforeEach(() => getDocs.mockResolvedValue({ docs: [mk('Incline Bench'), mk('Bench Press'), ...Array.from({ length: 12 }, (_, i) => mk(`Bench ${i}`))] }))

  it('returns [] for empty/whitespace query', async () => {
    expect(await searchExercises('  ')).toEqual([])
  })

  it('ranks prefix matches first and caps at 8', async () => {
    const r = await searchExercises('bench')
    expect(r).toHaveLength(8)
    expect(r[0].name.toLowerCase().startsWith('bench')).toBe(true)
    expect(r.map(e => e.name)).not.toContain('Incline Bench')
  })

  it('fetches once, then uses cache', async () => {
    await searchExercises('ben')
    await searchExercises('inc')
    expect(getDocs).toHaveBeenCalledTimes(1)
  })

  it('refetches after a new exercise is created', async () => {
    getDocs.mockClear()
    await searchExercises('ben')
    await getOrCreateExercise('X')
    await searchExercises('ben')
    expect(getDocs).toHaveBeenCalledTimes(1)
  })
})
