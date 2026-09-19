import { describe, expect, it } from 'vitest'

import {
  generateTrainingQuestions,
  hasConsecutiveSameDigits,
  matchesCategory,
} from './questionGenerator'
import type { QuestionCategory, TrainingQuestion } from './types'

function expectTwoDigitOperands(question: TrainingQuestion) {
  expect(question.leftOperand).toBeGreaterThanOrEqual(10)
  expect(question.leftOperand).toBeLessThanOrEqual(99)
  expect(question.rightOperand).toBeGreaterThanOrEqual(10)
  expect(question.rightOperand).toBeLessThanOrEqual(99)
}

describe('hasConsecutiveSameDigits', () => {
  it.each([
    [11, true],
    [100, true],
    [110, true],
    [122, true],
    [111, true],
    [101, false],
    [121, false],
    [123, false],
    [808, false],
  ])('returns %s for %i', (answer, expected) => {
    expect(hasConsecutiveSameDigits(answer)).toBe(expected)
  })
})

describe('matchesCategory', () => {
  it.each<[number, number, QuestionCategory]>([
    [3, 5, 'single-digit'],
    [23, 45, 'two-digit-no-carry'],
    [27, 38, 'two-digit-carry'],
    [43, 60, 'three-digit-no-ones-carry'],
    [56, 47, 'three-digit-ones-carry'],
  ])('accepts %i + %i as %s', (leftOperand, rightOperand, category) => {
    expect(matchesCategory(leftOperand, rightOperand, category)).toBe(true)
  })

  it.each<[number, number, QuestionCategory]>([
    [8, 9, 'single-digit'],
    [27, 38, 'two-digit-no-carry'],
    [23, 45, 'two-digit-carry'],
    [56, 47, 'three-digit-no-ones-carry'],
    [43, 60, 'three-digit-ones-carry'],
  ])('rejects %i + %i as %s', (leftOperand, rightOperand, category) => {
    expect(matchesCategory(leftOperand, rightOperand, category)).toBe(false)
  })
})

describe('generateTrainingQuestions', () => {
  const questions = generateTrainingQuestions(() => 0)

  it('generates ten questions with one-based indexes', () => {
    expect(questions).toHaveLength(10)
    expect(questions.map(({ questionIndex }) => questionIndex)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
  })

  it('generates questions 1-2 as single-digit additions with single-digit answers', () => {
    for (const question of questions.slice(0, 2)) {
      expect(question.category).toBe('single-digit')
      expect(question.leftOperand).toBeGreaterThanOrEqual(1)
      expect(question.leftOperand).toBeLessThanOrEqual(9)
      expect(question.rightOperand).toBeGreaterThanOrEqual(1)
      expect(question.rightOperand).toBeLessThanOrEqual(9)
      expect(question.answer).toBeLessThanOrEqual(9)
      expect(question.threeDigits).toBe(false)
    }
  })

  it('generates questions 3-4 with two-digit answers and no ones carry', () => {
    for (const question of questions.slice(2, 4)) {
      expectTwoDigitOperands(question)
      expect(question.category).toBe('two-digit-no-carry')
      expect(question.answer).toBeGreaterThanOrEqual(10)
      expect(question.answer).toBeLessThanOrEqual(99)
      expect(question.onesCarry).toBe(false)
      expect(question.threeDigits).toBe(false)
    }
  })

  it('generates questions 5-6 with two-digit answers and an ones carry', () => {
    for (const question of questions.slice(4, 6)) {
      expectTwoDigitOperands(question)
      expect(question.category).toBe('two-digit-carry')
      expect(question.answer).toBeGreaterThanOrEqual(10)
      expect(question.answer).toBeLessThanOrEqual(99)
      expect(question.onesCarry).toBe(true)
      expect(question.threeDigits).toBe(false)
    }
  })

  it('generates questions 7-8 with three-digit answers and no ones carry', () => {
    for (const question of questions.slice(6, 8)) {
      expectTwoDigitOperands(question)
      expect(question.category).toBe('three-digit-no-ones-carry')
      expect(question.answer).toBeGreaterThanOrEqual(100)
      expect(question.onesCarry).toBe(false)
      expect(question.threeDigits).toBe(true)
    }
  })

  it('generates questions 9-10 with three-digit answers and an ones carry', () => {
    for (const question of questions.slice(8, 10)) {
      expectTwoDigitOperands(question)
      expect(question.category).toBe('three-digit-ones-carry')
      expect(question.answer).toBeGreaterThanOrEqual(100)
      expect(question.onesCarry).toBe(true)
      expect(question.threeDigits).toBe(true)
    }
  })

  it('never generates an answer with consecutive equal digits', () => {
    expect(questions.every(({ answer }) => !hasConsecutiveSameDigits(answer))).toBe(true)
  })
})
