export type QuestionCategory =
  | 'single-digit'
  | 'two-digit-no-carry'
  | 'two-digit-carry'
  | 'three-digit-no-ones-carry'
  | 'three-digit-ones-carry'

export interface TrainingQuestion {
  questionIndex: number
  leftOperand: number
  rightOperand: number
  answer: number
  onesCarry: boolean
  threeDigits: boolean
  category: QuestionCategory
}

export interface QuestionResult {
  questionIndex: number
  leftOperand: number
  rightOperand: number
  correctAnswer: number
  elapsedMs: number
  onesCarry: boolean
  threeDigits: boolean
  category: QuestionCategory
}
