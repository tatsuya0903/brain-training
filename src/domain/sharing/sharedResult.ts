import type { TrainingAnalysis } from '../training/resultAnalyzer'
import { generateTrainingInsights, type CarryComparison } from '../training/resultAnalyzer'
import { SHARED_RESULT_VERSION, type SharedResultPayload } from './sharedResultCodec'

export interface SharedResultAnalysis {
  resultCount: number
  totalMs: number
  averageMs: number
  bestMs: number | null
  carryComparison: CarryComparison
  insights: ReturnType<typeof generateTrainingInsights>
}

export function createSharedResultPayload(
  analysis: TrainingAnalysis,
  playerName: string,
): SharedResultPayload | null {
  if (analysis.resultCount === 0 || analysis.averageMs === null) {
    return null
  }

  return {
    version: SHARED_RESULT_VERSION,
    playerName,
    resultCount: analysis.resultCount,
    totalMs: analysis.totalMs,
    averageMs: analysis.averageMs,
    bestMs: analysis.bestMs,
    carryAverageMs: analysis.carryComparison.carryAverageMs,
    noCarryAverageMs: analysis.carryComparison.noCarryAverageMs,
    carryMinusNoCarryMs: analysis.carryComparison.carryMinusNoCarryMs,
  }
}

export function createSharedResultAnalysis(payload: SharedResultPayload): SharedResultAnalysis {
  const carryComparison: CarryComparison = {
    carryAverageMs: payload.carryAverageMs,
    noCarryAverageMs: payload.noCarryAverageMs,
    carryMinusNoCarryMs: payload.carryMinusNoCarryMs,
  }

  return {
    resultCount: payload.resultCount,
    totalMs: payload.totalMs,
    averageMs: payload.averageMs,
    bestMs: payload.bestMs,
    carryComparison,
    insights: generateTrainingInsights(carryComparison),
  }
}
