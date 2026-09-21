import type { QuestionCategory, TrainingQuestion } from './types'

export type RandomSource = () => number

const QUESTION_CATEGORIES: readonly QuestionCategory[] = [
  'single-digit',
  'single-digit',
  'two-digit-no-carry',
  'two-digit-no-carry',
  'two-digit-carry',
  'two-digit-carry',
  'three-digit-no-ones-carry',
  'three-digit-no-ones-carry',
  'three-digit-ones-carry',
  'three-digit-ones-carry',
]

type QuestionOperands = Pick<TrainingQuestion, 'leftOperand' | 'rightOperand'>

export function isTrainingOperand(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 99
}

export function deriveQuestionMetadata(
  leftOperand: number,
  rightOperand: number,
): Pick<TrainingQuestion, 'answer' | 'onesCarry' | 'threeDigits' | 'category'> | null {
  if (!isTrainingOperand(leftOperand) || !isTrainingOperand(rightOperand)) {
    return null
  }

  const answer = leftOperand + rightOperand
  const operandsAreSingleDigit = leftOperand <= 9 && rightOperand <= 9
  const operandsAreTwoDigits = leftOperand >= 10 && rightOperand >= 10
  const onesCarry = (leftOperand % 10) + (rightOperand % 10) >= 10
  const threeDigits = answer >= 100

  if (operandsAreSingleDigit && answer <= 9) {
    return { answer, onesCarry, threeDigits, category: 'single-digit' }
  }

  if (!operandsAreTwoDigits) {
    return null
  }

  const category: QuestionCategory = threeDigits
    ? onesCarry
      ? 'three-digit-ones-carry'
      : 'three-digit-no-ones-carry'
    : onesCarry
      ? 'two-digit-carry'
      : 'two-digit-no-carry'

  return { answer, onesCarry, threeDigits, category }
}

export function hasConsecutiveSameDigits(answer: number): boolean {
  const digits = String(answer)

  for (let index = 0; index < digits.length - 1; index += 1) {
    if (digits[index] === digits[index + 1]) {
      return true
    }
  }

  return false
}

export function matchesCategory(
  leftOperand: number,
  rightOperand: number,
  category: QuestionCategory,
): boolean {
  return deriveQuestionMetadata(leftOperand, rightOperand)?.category === category
}

function createCandidates(category: QuestionCategory): QuestionOperands[] {
  const candidates: QuestionOperands[] = []
  const minimumOperand = category === 'single-digit' ? 1 : 10
  const maximumOperand = category === 'single-digit' ? 9 : 99

  for (let leftOperand = minimumOperand; leftOperand <= maximumOperand; leftOperand += 1) {
    for (let rightOperand = minimumOperand; rightOperand <= maximumOperand; rightOperand += 1) {
      const answer = leftOperand + rightOperand

      if (
        matchesCategory(leftOperand, rightOperand, category) &&
        !hasConsecutiveSameDigits(answer)
      ) {
        candidates.push({ leftOperand, rightOperand })
      }
    }
  }

  return candidates
}

const CANDIDATES_BY_CATEGORY: Readonly<Record<QuestionCategory, readonly QuestionOperands[]>> = {
  'single-digit': createCandidates('single-digit'),
  'two-digit-no-carry': createCandidates('two-digit-no-carry'),
  'two-digit-carry': createCandidates('two-digit-carry'),
  'three-digit-no-ones-carry': createCandidates('three-digit-no-ones-carry'),
  'three-digit-ones-carry': createCandidates('three-digit-ones-carry'),
}

export function generateTrainingQuestions(random: RandomSource = Math.random): TrainingQuestion[] {
  return QUESTION_CATEGORIES.map((category, questionIndex) => {
    const candidates = CANDIDATES_BY_CATEGORY[category]
    const selectedCandidate = candidates[Math.floor(random() * candidates.length)]

    if (!selectedCandidate) {
      throw new Error(`No candidate is available for category: ${category}`)
    }

    const { leftOperand, rightOperand } = selectedCandidate
    const metadata = deriveQuestionMetadata(leftOperand, rightOperand)

    if (!metadata) {
      throw new Error('Selected operands do not form a valid training question')
    }

    return {
      questionIndex: questionIndex + 1,
      leftOperand,
      rightOperand,
      ...metadata,
      category,
    }
  })
}
