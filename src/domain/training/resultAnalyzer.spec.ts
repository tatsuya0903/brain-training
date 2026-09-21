import { describe, expect, it } from 'vitest'

import type { QuestionResult } from './types'
import {
  CARRY_DIFFERENCE_THRESHOLD_MS,
  analyzeCarryComparison,
  analyzeTrainingResults,
  calculateMedianElapsedMs,
  formatCarryDifference,
  formatElapsedTime,
  generateTrainingInsights,
  shouldShowCarryTrend,
} from './resultAnalyzer'

function result(overrides: Partial<QuestionResult> = {}): QuestionResult {
  return {
    questionIndex: 1,
    leftOperand: 12,
    rightOperand: 13,
    correctAnswer: 25,
    elapsedMs: 100,
    onesCarry: false,
    threeDigits: false,
    category: 'two-digit-no-carry',
    ...overrides,
  }
}

const sessionResults: QuestionResult[] = [
  result({
    questionIndex: 1,
    leftOperand: 2,
    rightOperand: 3,
    correctAnswer: 5,
    elapsedMs: 100,
    category: 'single-digit',
  }),
  result({
    questionIndex: 2,
    leftOperand: 3,
    rightOperand: 4,
    correctAnswer: 7,
    elapsedMs: 200,
    category: 'single-digit',
  }),
  result({ questionIndex: 3, correctAnswer: 25, elapsedMs: 300 }),
  result({ questionIndex: 4, correctAnswer: 45, elapsedMs: 500 }),
  result({
    questionIndex: 5,
    leftOperand: 28,
    rightOperand: 34,
    correctAnswer: 62,
    elapsedMs: 700,
    onesCarry: true,
    category: 'two-digit-carry',
  }),
  result({
    questionIndex: 6,
    leftOperand: 48,
    rightOperand: 34,
    correctAnswer: 82,
    elapsedMs: 900,
    onesCarry: true,
    category: 'two-digit-carry',
  }),
  result({
    questionIndex: 7,
    leftOperand: 51,
    rightOperand: 50,
    correctAnswer: 101,
    elapsedMs: 1100,
    threeDigits: true,
    category: 'three-digit-no-ones-carry',
  }),
  result({
    questionIndex: 8,
    leftOperand: 62,
    rightOperand: 40,
    correctAnswer: 102,
    elapsedMs: 1300,
    threeDigits: true,
    category: 'three-digit-no-ones-carry',
  }),
  result({
    questionIndex: 9,
    leftOperand: 68,
    rightOperand: 43,
    correctAnswer: 111,
    elapsedMs: 1500,
    onesCarry: true,
    threeDigits: true,
    category: 'three-digit-ones-carry',
  }),
  result({
    questionIndex: 10,
    leftOperand: 78,
    rightOperand: 33,
    correctAnswer: 111,
    elapsedMs: 1700,
    onesCarry: true,
    threeDigits: true,
    category: 'three-digit-ones-carry',
  }),
]

describe('analyzeTrainingResults', () => {
  it('calculates total, average, median, and best times', () => {
    const analysis = analyzeTrainingResults(sessionResults)

    expect(analysis.totalMs).toBe(8300)
    expect(analysis.averageMs).toBe(830)
    expect(analysis.medianMs).toBe(800)
    expect(analysis.bestMs).toBe(100)
  })

  it('calculates answer-type and session-half averages', () => {
    const analysis = analyzeTrainingResults(sessionResults)

    expect(analysis.answerTypeAverages).toEqual({
      singleDigitProblemAverageMs: 150,
      twoDigitAnswerAverageMs: 600,
      threeDigitAnswerAverageMs: 1400,
    })
    expect(analysis.sessionHalfAverages).toEqual({
      firstHalfAverageMs: 360,
      secondHalfAverageMs: 1300,
    })
  })

  it('does not depend on result order for basic aggregation', () => {
    const shuffled = [...sessionResults].reverse()

    expect(analyzeTrainingResults(shuffled)).toMatchObject({
      totalMs: 8300,
      averageMs: 830,
      medianMs: 800,
      bestMs: 100,
    })
  })

  it('does not mutate the source results', () => {
    const originalOrder = sessionResults.map((item) => item.questionIndex)

    analyzeTrainingResults(sessionResults)

    expect(sessionResults.map((item) => item.questionIndex)).toEqual(originalOrder)
  })

  it('returns unavailable averages rather than zero or NaN for empty results', () => {
    const analysis = analyzeTrainingResults([])

    expect(analysis).toMatchObject({
      resultCount: 0,
      totalMs: 0,
      averageMs: null,
      medianMs: null,
      bestMs: null,
      carryComparison: {
        carryAverageMs: null,
        noCarryAverageMs: null,
        carryMinusNoCarryMs: null,
      },
    })
  })
})

describe('calculateMedianElapsedMs', () => {
  it('returns null for no results', () => {
    expect(calculateMedianElapsedMs([])).toBeNull()
  })

  it('returns the only elapsed time for one result', () => {
    expect(calculateMedianElapsedMs([result({ elapsedMs: 123.45 })])).toBe(123.45)
  })

  it('returns the middle elapsed time for an odd count', () => {
    expect(
      calculateMedianElapsedMs([
        result({ elapsedMs: 900 }),
        result({ elapsedMs: 100 }),
        result({ elapsedMs: 500 }),
      ]),
    ).toBe(500)
  })

  it('averages the two middle elapsed times for an even count', () => {
    expect(
      calculateMedianElapsedMs([
        result({ elapsedMs: 800 }),
        result({ elapsedMs: 200 }),
        result({ elapsedMs: 600 }),
        result({ elapsedMs: 400 }),
      ]),
    ).toBe(500)
  })

  it('uses the fifth and sixth elapsed times for ten results', () => {
    expect(calculateMedianElapsedMs(sessionResults)).toBe(800)
  })

  it('does not mutate the source results', () => {
    const source = [
      result({ questionIndex: 1, elapsedMs: 300 }),
      result({ questionIndex: 2, elapsedMs: 100 }),
      result({ questionIndex: 3, elapsedMs: 200 }),
    ]
    const originalOrder = source.map((item) => item.elapsedMs)

    calculateMedianElapsedMs(source)

    expect(source.map((item) => item.elapsedMs)).toEqual(originalOrder)
  })

  it('returns the same median regardless of result order', () => {
    const reversed = [...sessionResults].reverse()

    expect(calculateMedianElapsedMs(reversed)).toBe(calculateMedianElapsedMs(sessionResults))
  })

  it('preserves decimal precision', () => {
    expect(
      calculateMedianElapsedMs([
        result({ elapsedMs: 100.1 }),
        result({ elapsedMs: 200.2 }),
        result({ elapsedMs: 300.3 }),
        result({ elapsedMs: 400.4 }),
      ]),
    ).toBeCloseTo(250.25)
  })
})

describe('analyzeCarryComparison', () => {
  it('excludes single-digit questions and calculates carry minus no-carry', () => {
    const comparison = analyzeCarryComparison([
      result({ elapsedMs: 10_000, category: 'single-digit', onesCarry: false }),
      result({ elapsedMs: 800, onesCarry: false }),
      result({ elapsedMs: 1000, onesCarry: false }),
      result({ elapsedMs: 1200, onesCarry: true, category: 'two-digit-carry' }),
      result({ elapsedMs: 1400, onesCarry: true, category: 'two-digit-carry' }),
    ])

    expect(comparison).toEqual({
      carryAverageMs: 1300,
      noCarryAverageMs: 900,
      carryMinusNoCarryMs: 400,
    })
    expect(comparison.carryMinusNoCarryMs).toBeGreaterThan(0)
  })

  it('returns a negative difference when carry questions are faster', () => {
    const comparison = analyzeCarryComparison([
      result({ elapsedMs: 1200, onesCarry: false }),
      result({ elapsedMs: 800, onesCarry: true, category: 'two-digit-carry' }),
    ])

    expect(comparison.carryMinusNoCarryMs).toBe(-400)
    expect(comparison.carryMinusNoCarryMs).toBeLessThan(0)
  })

  it('returns zero when the averages are equal', () => {
    const comparison = analyzeCarryComparison([
      result({ elapsedMs: 1000, onesCarry: false }),
      result({ elapsedMs: 1000, onesCarry: true, category: 'two-digit-carry' }),
    ])

    expect(comparison.carryMinusNoCarryMs).toBe(0)
  })

  it('returns a null difference when either comparison group is missing', () => {
    expect(analyzeCarryComparison([result({ onesCarry: false })])).toEqual({
      carryAverageMs: null,
      noCarryAverageMs: 100,
      carryMinusNoCarryMs: null,
    })
    expect(
      analyzeCarryComparison([result({ onesCarry: true, category: 'two-digit-carry' })]),
    ).toEqual({
      carryAverageMs: 100,
      noCarryAverageMs: null,
      carryMinusNoCarryMs: null,
    })
  })

  it('returns unavailable values for empty results', () => {
    expect(analyzeCarryComparison([])).toEqual({
      carryAverageMs: null,
      noCarryAverageMs: null,
      carryMinusNoCarryMs: null,
    })
  })
})

describe('generateTrainingInsights', () => {
  it('identifies carry questions as slower at the positive threshold boundary', () => {
    const [insight] = generateTrainingInsights({
      carryAverageMs: 1100,
      noCarryAverageMs: 1000,
      carryMinusNoCarryMs: CARRY_DIFFERENCE_THRESHOLD_MS,
    })

    expect(insight?.type).toBe('carry-slower')
  })

  it('identifies differences inside the threshold as similar', () => {
    const [insight] = generateTrainingInsights({
      carryAverageMs: 1099,
      noCarryAverageMs: 1000,
      carryMinusNoCarryMs: CARRY_DIFFERENCE_THRESHOLD_MS - 1,
    })

    expect(insight?.type).toBe('carry-similar')
  })

  it('identifies carry questions as faster at the negative threshold boundary', () => {
    const [insight] = generateTrainingInsights({
      carryAverageMs: 900,
      noCarryAverageMs: 1000,
      carryMinusNoCarryMs: -CARRY_DIFFERENCE_THRESHOLD_MS,
    })

    expect(insight?.type).toBe('carry-faster')
  })

  it('reports insufficient comparison data', () => {
    const [insight] = generateTrainingInsights({
      carryAverageMs: null,
      noCarryAverageMs: 1000,
      carryMinusNoCarryMs: null,
    })

    expect(insight?.type).toBe('carry-comparison-unavailable')
  })
})

describe('shouldShowCarryTrend', () => {
  it('shows the trend when carry questions are clearly slower', () => {
    expect(
      shouldShowCarryTrend({
        carryAverageMs: 1300,
        noCarryAverageMs: 1000,
        carryMinusNoCarryMs: 300,
      }),
    ).toBe(true)
  })

  it('does not show the trend when carry questions are faster', () => {
    expect(
      shouldShowCarryTrend({
        carryAverageMs: 800,
        noCarryAverageMs: 1000,
        carryMinusNoCarryMs: -200,
      }),
    ).toBe(false)
  })

  it('does not show the trend when the difference is inside the existing threshold', () => {
    expect(
      shouldShowCarryTrend({
        carryAverageMs: 1099,
        noCarryAverageMs: 1000,
        carryMinusNoCarryMs: CARRY_DIFFERENCE_THRESHOLD_MS - 1,
      }),
    ).toBe(false)
  })

  it('does not show the trend when comparison data is unavailable', () => {
    expect(
      shouldShowCarryTrend({
        carryAverageMs: null,
        noCarryAverageMs: 1000,
        carryMinusNoCarryMs: null,
      }),
    ).toBe(false)
  })

  it('shows the trend at the existing positive threshold boundary', () => {
    expect(
      shouldShowCarryTrend({
        carryAverageMs: 1100,
        noCarryAverageMs: 1000,
        carryMinusNoCarryMs: CARRY_DIFFERENCE_THRESHOLD_MS,
      }),
    ).toBe(true)
  })
})

describe('result formatting', () => {
  it('formats milliseconds as seconds only for display', () => {
    expect(formatElapsedTime(18_420)).toBe('18.42秒')
    expect(formatElapsedTime(1840)).toBe('1.84秒')
    expect(formatElapsedTime(null)).toBe('算出できません')
  })

  it('explains the carry difference direction in words', () => {
    expect(
      formatCarryDifference({
        carryAverageMs: 1340,
        noCarryAverageMs: 1000,
        carryMinusNoCarryMs: 340,
      }),
    ).toBe('繰り上がりありの方が0.34秒長い')
    expect(
      formatCarryDifference({
        carryAverageMs: 790,
        noCarryAverageMs: 1000,
        carryMinusNoCarryMs: -210,
      }),
    ).toBe('繰り上がりありの方が0.21秒速い')
  })
})
