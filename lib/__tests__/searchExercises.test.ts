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

describe('searchExercises fuzzy', () => {
  const lib = (...names: string[]) => async () => {
    await getOrCreateExercise('X') // bump cache generation
    getDocs.mockResolvedValue({ docs: names.map(n => mk(n)) })
  }
  const base = lib('Seated Row', 'Biceps Curls (Machine)', 'EZ Bar Curl', 'Bench Press', 'Lat Pulldown')

  it('tolerates a typo', async () => {
    await base()
    expect((await searchExercises('seted row'))[0].name).toBe('Seated Row')
  })

  it('matches token prefixes', async () => {
    await base()
    expect((await searchExercises('bicep curl')).map(e => e.name)).toContain('Biceps Curls (Machine)')
  })

  it('short query only prefix-matches', async () => {
    await base()
    expect((await searchExercises('ez')).map(e => e.name)).toEqual(['EZ Bar Curl'])
  })

  it('ranks prefix before substring before fuzzy', async () => {
    await lib('Seated Row', 'Row Machine', 'Rowing Barbell', 'Rod Lift')()
    const r = (await searchExercises('row')).map(e => e.name)
    expect(r.slice(0, 3)).toEqual(['Row Machine', 'Rowing Barbell', 'Seated Row'])
  })

  it('caps typo results at 8', async () => {
    await lib(...Array.from({ length: 12 }, (_, i) => `Curl ${i}`))()
    expect((await searchExercises('curll')).length).toBeLessThanOrEqual(8)
  })

  it('returns [] for no match and punctuation-only', async () => {
    await base()
    expect(await searchExercises('zzzzzz')).toEqual([])
    expect(await searchExercises('--')).toEqual([])
  })
})
