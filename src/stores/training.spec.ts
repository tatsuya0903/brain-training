import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTrainingStore } from './training'

function enterAnswer(store: ReturnType<typeof useTrainingStore>, answer: number) {
  for (const digit of String(answer)) store.appendDigit(digit)
}

function startQuestion(time = 100) {
  const store = useTrainingStore()
  store.startTraining(() => 0)
  store.beginQuestion(() => time)
  return store
}

describe('training store', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.restoreAllMocks())

  it('prepares ten questions without timing before the view is ready', () => {
    const store = useTrainingStore()
    store.startTraining(() => 0)
    expect(store.questions).toHaveLength(10)
    expect(store.currentQuestion).toBe(store.questions[0])
    expect(store.currentQuestionNumber).toBe(1)
    expect(store.progress).toBe(10)
    expect(store.questionStartedAt).toBeNull()
    store.appendDigit('5')
    expect(store.currentAnswer).toBe('')
    expect(store.submitAnswer()).toBe('empty')
    store.beginQuestion(() => 100)
    expect(store.questionStartedAt).toBe(100)
    expect(store.canAnswer).toBe(true)
  })

  it('saves the exact result once and holds the current question during feedback', () => {
    const store = startQuestion()
    const question = store.currentQuestion!
    enterAnswer(store, question.answer)
    expect(store.submitAnswer(() => 375.125)).toBe('correct')
    expect(store.results).toEqual([
      {
        questionIndex: question.questionIndex,
        leftOperand: question.leftOperand,
        rightOperand: question.rightOperand,
        correctAnswer: question.answer,
        elapsedMs: 275.125,
        onesCarry: question.onesCarry,
        threeDigits: question.threeDigits,
        category: question.category,
      },
    ])
    expect(store.feedback).toBe('correct')
    expect(store.correctElapsedMs).toBe(275.125)
    expect(store.currentQuestionNumber).toBe(1)
    expect(store.currentAnswer).toBe('')
    expect(store.questionStartedAt).toBeNull()
    expect(store.canAnswer).toBe(false)
    store.appendDigit('9')
    store.deleteLastDigit()
    store.beginQuestion(() => 500)
    expect(store.currentAnswer).toBe('')
    expect(store.submitAnswer(() => 500)).toBe('empty')
    expect(store.results).toHaveLength(1)
    expect(store.questionStartedAt).toBeNull()
  })

  it('excludes feedback and rendering time from the next elapsedMs', () => {
    const store = startQuestion()
    enterAnswer(store, store.currentQuestion!.answer)
    store.submitAnswer(() => 375)
    expect(store.advanceAfterFeedback()).toBe('next')
    expect(store.currentQuestionNumber).toBe(2)
    expect(store.feedback).toBeNull()
    expect(store.questionStartedAt).toBeNull()
    expect(store.canAnswer).toBe(false)
    store.beginQuestion(() => 775)
    expect(store.questionStartedAt).toBe(775)
    enterAnswer(store, store.currentQuestion!.answer)
    store.submitAnswer(() => 975)
    expect(store.results.map(({ elapsedMs }) => elapsedMs)).toEqual([275, 200])
  })

  it('uses performance.now by default', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(350)
    const store = useTrainingStore()
    store.startTraining(() => 0)
    store.beginQuestion()
    enterAnswer(store, store.currentQuestion!.answer)
    store.submitAnswer()
    expect(now).toHaveBeenCalledTimes(2)
    expect(store.results[0]?.elapsedMs).toBe(250)
  })

  it('keeps the same question and original start time after an incorrect answer', () => {
    const store = startQuestion()
    const answer = store.currentQuestion!.answer
    enterAnswer(store, answer + 1)
    expect(store.submitAnswer(() => 200)).toBe('incorrect')
    expect(store.feedback).toBe('incorrect')
    expect(store.currentQuestionNumber).toBe(1)
    expect(store.currentAnswer).toBe('')
    expect(store.questionStartedAt).toBe(100)
    expect(store.results).toHaveLength(0)
    expect(store.canAnswer).toBe(true)
    store.beginQuestion(() => 300)
    expect(store.questionStartedAt).toBe(100)
    enterAnswer(store, answer)
    expect(store.feedback).toBeNull()
    expect(store.submitAnswer(() => 425)).toBe('correct')
    expect(store.results[0]?.elapsedMs).toBe(325)
  })

  it('does not submit empty input or advance without correct feedback', () => {
    const store = startQuestion()
    expect(store.submitAnswer(() => 200)).toBe('empty')
    expect(store.advanceAfterFeedback()).toBe('ignored')
    expect(store.feedback).toBeNull()
    expect(store.results).toHaveLength(0)
    expect(store.currentQuestionNumber).toBe(1)
    expect(store.questionStartedAt).toBe(100)
  })

  it('completes only after the tenth feedback and preserves ten results', () => {
    const store = startQuestion(0)
    let now = 0
    for (let number = 1; number <= 10; number += 1) {
      now += 125
      enterAnswer(store, store.currentQuestion!.answer)
      expect(store.submitAnswer(() => now)).toBe('correct')
      expect(store.isCompleted).toBe(false)
      expect(store.feedback).toBe('correct')
      expect(store.currentQuestionNumber).toBe(number)
      now += 350
      expect(store.advanceAfterFeedback()).toBe(number === 10 ? 'completed' : 'next')
      store.beginQuestion(() => now)
    }
    expect(store.isCompleted).toBe(true)
    expect(store.results).toHaveLength(10)
    expect(store.results.every(({ elapsedMs }) => elapsedMs === 125)).toBe(true)
    expect(store.progress).toBe(100)
    expect(store.questionStartedAt).toBeNull()
    expect(store.canAnswer).toBe(false)
    expect(store.advanceAfterFeedback()).toBe('ignored')
  })

  it.each(['correct', 'incorrect'] as const)('clears %s feedback when restarting', (feedback) => {
    const store = startQuestion()
    enterAnswer(store, store.currentQuestion!.answer + (feedback === 'incorrect' ? 1 : 0))
    store.submitAnswer(() => 200)
    expect(store.feedback).toBe(feedback)
    store.startTraining(() => 0.999)
    expect(store.currentQuestionNumber).toBe(1)
    expect(store.currentAnswer).toBe('')
    expect(store.results).toHaveLength(0)
    expect(store.isCompleted).toBe(false)
    expect(store.feedback).toBeNull()
    expect(store.questionStartedAt).toBeNull()
    expect(store.correctElapsedMs).toBeNull()
    expect(store.advanceAfterFeedback()).toBe('ignored')
  })
})
