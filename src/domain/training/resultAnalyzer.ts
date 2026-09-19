import type { QuestionResult } from './types'

export const CARRY_DIFFERENCE_THRESHOLD_MS = 100

export type TrainingInsightType =
  'carry-slower' | 'carry-similar' | 'carry-faster' | 'carry-comparison-unavailable'

export interface TrainingInsight {
  type: TrainingInsightType
  text: string
}

export interface CarryComparison {
  carryAverageMs: number | null
  noCarryAverageMs: number | null
  /** carryAverageMs - noCarryAverageMs. A positive value means carry questions were slower. */
  carryMinusNoCarryMs: number | null
}

export interface AnswerTypeAverages {
  singleDigitProblemAverageMs: number | null
  twoDigitAnswerAverageMs: number | null
  threeDigitAnswerAverageMs: number | null
}

export interface SessionHalfAverages {
  firstHalfAverageMs: number | null
  secondHalfAverageMs: number | null
}

export interface TrainingAnalysis {
  resultCount: number
  totalMs: number
  averageMs: number | null
  bestMs: number | null
  carryComparison: CarryComparison
  answerTypeAverages: AnswerTypeAverages
  sessionHalfAverages: SessionHalfAverages
  insights: TrainingInsight[]
}

function averageElapsedMs(results: readonly QuestionResult[]): number | null {
  if (results.length === 0) {
    return null
  }

  return results.reduce((total, result) => total + result.elapsedMs, 0) / results.length
}

export function analyzeCarryComparison(results: readonly QuestionResult[]): CarryComparison {
  const twoDigitOperandResults = results.filter((result) => result.category !== 'single-digit')
  const carryAverageMs = averageElapsedMs(
    twoDigitOperandResults.filter((result) => result.onesCarry),
  )
  const noCarryAverageMs = averageElapsedMs(
    twoDigitOperandResults.filter((result) => !result.onesCarry),
  )

  return {
    carryAverageMs,
    noCarryAverageMs,
    carryMinusNoCarryMs:
      carryAverageMs === null || noCarryAverageMs === null
        ? null
        : carryAverageMs - noCarryAverageMs,
  }
}

export function generateTrainingInsights(carryComparison: CarryComparison): TrainingInsight[] {
  const differenceMs = carryComparison.carryMinusNoCarryMs

  if (differenceMs === null) {
    return [
      {
        type: 'carry-comparison-unavailable',
        text: '繰り上がり有無を比較するための回答データが不足しています。',
      },
    ]
  }

  if (Math.abs(differenceMs) < CARRY_DIFFERENCE_THRESHOLD_MS) {
    return [
      {
        type: 'carry-similar',
        text: '繰り上がりの有無による平均回答時間の差はほとんどありませんでした。',
      },
    ]
  }

  if (differenceMs > 0) {
    return [
      {
        type: 'carry-slower',
        text: '繰り上がりありの問題は、繰り上がりなしの問題より平均回答時間が長くなりました。',
      },
    ]
  }

  return [
    {
      type: 'carry-faster',
      text: '繰り上がりありの問題は、繰り上がりなしの問題より平均回答時間が短くなりました。',
    },
  ]
}

export function analyzeTrainingResults(results: readonly QuestionResult[]): TrainingAnalysis {
  const totalMs = results.reduce((total, result) => total + result.elapsedMs, 0)
  const averageMs = averageElapsedMs(results)
  const bestMs =
    results.length === 0 ? null : Math.min(...results.map((result) => result.elapsedMs))
  const carryComparison = analyzeCarryComparison(results)
  const orderedResults = [...results].sort(
    (left, right) => left.questionIndex - right.questionIndex,
  )
  const firstHalfEnd = Math.ceil(orderedResults.length / 2)

  return {
    resultCount: results.length,
    totalMs,
    averageMs,
    bestMs,
    carryComparison,
    answerTypeAverages: {
      singleDigitProblemAverageMs: averageElapsedMs(
        results.filter((result) => result.category === 'single-digit'),
      ),
      twoDigitAnswerAverageMs: averageElapsedMs(
        results.filter((result) => result.correctAnswer >= 10 && result.correctAnswer <= 99),
      ),
      threeDigitAnswerAverageMs: averageElapsedMs(
        results.filter((result) => result.correctAnswer >= 100),
      ),
    },
    sessionHalfAverages: {
      firstHalfAverageMs: averageElapsedMs(orderedResults.slice(0, firstHalfEnd)),
      secondHalfAverageMs: averageElapsedMs(orderedResults.slice(firstHalfEnd)),
    },
    insights: generateTrainingInsights(carryComparison),
  }
}

export function formatElapsedTime(elapsedMs: number | null): string {
  return elapsedMs === null ? '算出できません' : `${(elapsedMs / 1000).toFixed(2)}秒`
}

export function formatCarryDifference(comparison: CarryComparison): string {
  const differenceMs = comparison.carryMinusNoCarryMs

  if (differenceMs === null) {
    return '比較に必要なデータがありません'
  }

  if (Math.abs(differenceMs) < CARRY_DIFFERENCE_THRESHOLD_MS) {
    return `繰り上がり有無の差はほぼ同じです（差 ${formatElapsedTime(Math.abs(differenceMs))}）`
  }

  if (differenceMs > 0) {
    return `繰り上がりありの方が${formatElapsedTime(differenceMs)}長い`
  }

  return `繰り上がりありの方が${formatElapsedTime(Math.abs(differenceMs))}速い`
}
