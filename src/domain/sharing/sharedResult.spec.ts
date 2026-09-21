import { describe, expect, it } from 'vitest'

import { analyzeTrainingResults } from '../training/resultAnalyzer'
import type { QuestionResult } from '../training/types'
import { createSharedResultPayload, reconstructSharedResults } from './sharedResult'
import { decodeSharedResult, encodeSharedResult } from './sharedResultCodec'

const originalResults: QuestionResult[] = [
  [2, 3, 100, 'single-digit'],
  [6, 3, 200, 'single-digit'],
  [12, 13, 300, 'two-digit-no-carry'],
  [21, 23, 500, 'two-digit-no-carry'],
  [28, 34, 700, 'two-digit-carry'],
  [48, 34, 900, 'two-digit-carry'],
  [51, 50, 1100, 'three-digit-no-ones-carry'],
  [62, 40, 1300, 'three-digit-no-ones-carry'],
  [68, 43, 1500, 'three-digit-ones-carry'],
  [78, 33, 1700, 'three-digit-ones-carry'],
].map(([leftOperand, rightOperand, elapsedMs, category], index) => {
  const correctAnswer = (leftOperand as number) + (rightOperand as number)
  return {
    questionIndex: index + 1,
    leftOperand: leftOperand as number,
    rightOperand: rightOperand as number,
    correctAnswer,
    elapsedMs: elapsedMs as number,
    onesCarry: ((leftOperand as number) % 10) + ((rightOperand as number) % 10) >= 10,
    threeDigits: correctAnswer >= 100,
    category: category as QuestionResult['category'],
  }
})

describe('shared result reconstruction', () => {
  it('reconstructs QuestionResult fields from operands and preserves order', () => {
    const payload = createSharedResultPayload(originalResults, 'たつや')
    expect(payload).not.toBeNull()

    const decoded = decodeSharedResult(encodeSharedResult(payload!))
    const reconstructed = decoded ? reconstructSharedResults(decoded) : null

    expect(reconstructed).toEqual(originalResults)
    expect(reconstructed?.map(({ questionIndex }) => questionIndex)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
  })

  it('feeds reconstructed results through the same analyzer with identical output', () => {
    const payload = createSharedResultPayload(originalResults, 'たつや')!
    const decoded = decodeSharedResult(encodeSharedResult(payload))!
    const reconstructed = reconstructSharedResults(decoded)!
    const localAnalysis = analyzeTrainingResults(originalResults)
    const sharedAnalysis = analyzeTrainingResults(reconstructed)

    expect(sharedAnalysis).toEqual(localAnalysis)
    expect(sharedAnalysis).toMatchObject({
      totalMs: localAnalysis.totalMs,
      averageMs: localAnalysis.averageMs,
      medianMs: localAnalysis.medianMs,
      bestMs: localAnalysis.bestMs,
      carryComparison: localAnalysis.carryComparison,
      insights: localAnalysis.insights,
    })
  })
})
