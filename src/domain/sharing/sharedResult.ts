import { deriveQuestionMetadata } from '../training/questionGenerator'
import type { QuestionResult } from '../training/types'
import {
  SHARED_RESULT_COUNT,
  SHARED_RESULT_VERSION,
  type SharedResultPayload,
} from './sharedResultCodec'

export function createSharedResultPayload(
  results: readonly QuestionResult[],
  playerName: string,
): SharedResultPayload | null {
  if (results.length !== SHARED_RESULT_COUNT) {
    return null
  }

  return {
    version: SHARED_RESULT_VERSION,
    playerName,
    results: results.map(({ leftOperand, rightOperand, elapsedMs }) => ({
      leftOperand,
      rightOperand,
      elapsedMs,
    })),
  }
}

export function reconstructSharedResults(payload: SharedResultPayload): QuestionResult[] | null {
  if (payload.results.length !== SHARED_RESULT_COUNT) {
    return null
  }

  const results: QuestionResult[] = []

  for (const [index, result] of payload.results.entries()) {
    const metadata = deriveQuestionMetadata(result.leftOperand, result.rightOperand)
    if (!metadata) {
      return null
    }

    results.push({
      questionIndex: index + 1,
      leftOperand: result.leftOperand,
      rightOperand: result.rightOperand,
      correctAnswer: metadata.answer,
      elapsedMs: result.elapsedMs,
      onesCarry: metadata.onesCarry,
      threeDigits: metadata.threeDigits,
      category: metadata.category,
    })
  }

  return results
}
