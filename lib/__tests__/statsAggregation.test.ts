import {
  estimate1RM,
  rollingAverageByDate,
  average,
  isoWeekKey,
  weeklyAverages,
  classifyTrend,
  lastNDays,
  proteinPerKgSeries,
  nightsBelowThreshold,
} from '../statsAggregation'

describe('estimate1RM', () => {
  it('returns weight as-is for a single rep', () => {
    expect(estimate1RM(100, 1)).toBe(100)
  })

  it('applies the Epley formula for multiple reps', () => {
    // 100kg x 5 -> 100 * (1 + 5/30) = 116.67
    expect(estimate1RM(100, 5)).toBeCloseTo(116.67, 1)
  })

  it('treats zero reps as the raw weight (guards against div weirdness)', () => {
    expect(estimate1RM(80, 0)).toBe(80)
  })
})

describe('average', () => {
  it('returns null for an empty array', () => {
    expect(average([])).toBeNull()
  })

  it('averages values', () => {
    expect(average([1, 2, 3])).toBe(2)
  })
})

describe('rollingAverageByDate', () => {
  it('averages only points within the trailing window, keyed by date not index', () => {
    const series = [
      { date: '2026-01-01', value: 10 },
      { date: '2026-01-02', value: 20 },
      { date: '2026-01-05', value: 40 }, // gap of 3 days before this point
    ]
    const result = rollingAverageByDate(series, 3)
    // 01-01: window [12-30..01-01] -> only 01-01 present -> 10
    expect(result[0]).toEqual({ date: '2026-01-01', value: 10 })
    // 01-02: window [12-31..01-02] -> 01-01,01-02 present -> 15
    expect(result[1]).toEqual({ date: '2026-01-02', value: 15 })
    // 01-05: window [01-03..01-05] -> only 01-05 present (gap excludes 01-01/01-02) -> 40
    expect(result[2]).toEqual({ date: '2026-01-05', value: 40 })
  })

  it('handles unsorted input', () => {
    const series = [
      { date: '2026-01-02', value: 20 },
      { date: '2026-01-01', value: 10 },
    ]
    const result = rollingAverageByDate(series, 7)
    expect(result.map((r) => r.date)).toEqual(['2026-01-01', '2026-01-02'])
  })
})

describe('isoWeekKey', () => {
  it('assigns Monday-Sunday to the same week', () => {
    // 2026-02-09 is a Monday, 2026-02-15 is the following Sunday
    expect(isoWeekKey('2026-02-09')).toBe(isoWeekKey('2026-02-15'))
  })

  it('assigns adjacent weeks different keys', () => {
    expect(isoWeekKey('2026-02-08')).not.toBe(isoWeekKey('2026-02-09'))
  })
})

describe('weeklyAverages', () => {
  it('groups by ISO week and averages, sorted by week start', () => {
    const series = [
      { date: '2026-02-09', value: 80 }, // Mon wk A
      { date: '2026-02-10', value: 82 }, // Tue wk A
      { date: '2026-02-16', value: 90 }, // Mon wk B
    ]
    const result = weeklyAverages(series)
    expect(result).toHaveLength(2)
    expect(result[0].weekStart).toBe('2026-02-09')
    expect(result[0].average).toBe(81)
    expect(result[1].weekStart).toBe('2026-02-16')
    expect(result[1].average).toBe(90)
  })
})

describe('classifyTrend', () => {
  it('classifies flat for fewer than 2 values', () => {
    expect(classifyTrend([5])).toBe('flat')
    expect(classifyTrend([])).toBe('flat')
  })

  it('classifies up for a clear increase', () => {
    expect(classifyTrend([80, 85])).toBe('up')
  })

  it('classifies down for a clear decrease', () => {
    expect(classifyTrend([85, 80])).toBe('down')
  })

  it('treats tiny moves under the threshold as flat', () => {
    expect(classifyTrend([80, 80.2])).toBe('flat')
  })

  it('handles a zero starting value', () => {
    expect(classifyTrend([0, 5])).toBe('up')
    expect(classifyTrend([0, 0])).toBe('flat')
  })
})

describe('proteinPerKgSeries', () => {
  it('joins protein intake against the nearest prior bodyweight', () => {
    const nutrition = [
      { date: '2026-01-01', protein_g: 160 },
      { date: '2026-01-03', protein_g: 150 },
    ]
    const weights = [
      { date: '2026-01-01', weight_kg: 80 },
      { date: '2026-01-05', weight_kg: 82 }, // logged after 01-03, shouldn't apply to it
    ]
    const result = proteinPerKgSeries(nutrition, weights)
    expect(result).toEqual([
      { date: '2026-01-01', gramsPerKg: 2 },
      { date: '2026-01-03', gramsPerKg: 150 / 80 },
    ])
  })

  it('skips days with no prior bodyweight logged', () => {
    const result = proteinPerKgSeries(
      [{ date: '2026-01-01', protein_g: 160 }],
      [{ date: '2026-01-05', weight_kg: 80 }]
    )
    expect(result).toEqual([])
  })

  it('skips days with no protein logged', () => {
    const result = proteinPerKgSeries(
      [{ date: '2026-01-01', protein_g: null }],
      [{ date: '2026-01-01', weight_kg: 80 }]
    )
    expect(result).toEqual([])
  })
})

describe('nightsBelowThreshold', () => {
  it('returns dates under the threshold', () => {
    const series = [
      { date: '2026-01-01', hours: 6.5 },
      { date: '2026-01-02', hours: 7.5 },
      { date: '2026-01-03', hours: 7 },
    ]
    expect(nightsBelowThreshold(series, 7)).toEqual(['2026-01-01'])
  })
})

describe('lastNDays', () => {
  it('filters to the trailing window relative to `now`', () => {
    const series = [
      { date: '2026-01-01' },
      { date: '2026-01-05' },
      { date: '2026-01-10' },
    ]
    const result = lastNDays(series, 7, new Date('2026-01-10'))
    expect(result.map((r) => r.date)).toEqual(['2026-01-05', '2026-01-10'])
  })
})
