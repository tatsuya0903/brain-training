import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useTrainingStore } from './training'

function enterAnswer(store: ReturnType<typeof useTrainingStore>, answer: number) {
  for (const digit of String(answer)) {
    store.appendDigit(digit)
  }
}

describe('training store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts a new ten-question training at the first question', () => {
    const store = useTrainingStore()

    store.startTraining(
      () => 0,
      () => 100,
    )

    expect(store.questions).toHaveLength(10)
    expect(store.currentQuestion).toBe(store.questions[0])
    expect(store.currentQuestionNumber).toBe(1)
    expect(store.progress).toBe(10)
    expect(store.questionStartedAt).toBe(100)
  })

  it('moves forward, clears input, and stores a timed result after a correct answer', () => {
    const store = useTrainingStore()
    store.startTraining(
      () => 0,
      () => 100,
    )
    const firstQuestion = store.currentQuestion

    expect(firstQuestion).toBeDefined()
    enterAnswer(store, firstQuestion!.answer)

    expect(store.submitAnswer(() => 375)).toBe('correct')
    expect(store.currentQuestionNumber).toBe(2)
    expect(store.currentAnswer).toBe('')
    expect(store.questionStartedAt).toBe(375)
    expect(store.results).toEqual([
      {
        questionIndex: firstQuestion!.questionIndex,
        leftOperand: firstQuestion!.leftOperand,
        rightOperand: firstQuestion!.rightOperand,
        correctAnswer: firstQuestion!.answer,
        elapsedMs: 275,
        onesCarry: firstQuestion!.onesCarry,
        threeDigits: firstQuestion!.threeDigits,
        category: firstQuestion!.category,
      },
    ])
  })

  it('uses performance.now by default', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(350)
    const store = useTrainingStore()

    store.startTraining(() => 0)
    enterAnswer(store, store.currentQuestion!.answer)
    store.submitAnswer()

    expect(now).toHaveBeenCalledTimes(2)
    expect(store.results[0]?.elapsedMs).toBe(250)
  })

  it('keeps the same question and original start time after an incorrect answer', () => {
    const store = useTrainingStore()
    store.startTraining(
      () => 0,
      () => 100,
    )
    const correctAnswer = store.currentQuestion!.answer
    enterAnswer(store, correctAnswer + 1)

    expect(store.submitAnswer(() => 200)).toBe('incorrect')
    expect(store.currentQuestionNumber).toBe(1)
    expect(store.currentAnswer).toBe('')
    expect(store.questionStartedAt).toBe(100)
    expect(store.results).toHaveLength(0)

    enterAnswer(store, correctAnswer)
    expect(store.submitAnswer(() => 425)).toBe('correct')
    expect(store.results[0]?.elapsedMs).toBe(325)
  })

  it('does not submit an empty answer', () => {
    const store = useTrainingStore()
    store.startTraining(
      () => 0,
      () => 100,
    )

    expect(store.submitAnswer(() => 200)).toBe('empty')
    expect(store.currentQuestionNumber).toBe(1)
    expect(store.results).toHaveLength(0)
  })

  it('completes after all ten correct answers and preserves ten results', () => {
    const store = useTrainingStore()
    let currentTime = 0
    store.startTraining(
      () => 0,
      () => currentTime,
    )

    for (let questionNumber = 1; questionNumber <= 10; questionNumber += 1) {
      currentTime += 125
      enterAnswer(store, store.currentQuestion!.answer)
      const result = store.submitAnswer(() => currentTime)

      expect(result).toBe(questionNumber === 10 ? 'completed' : 'correct')
    }

    expect(store.isCompleted).toBe(true)
    expect(store.results).toHaveLength(10)
    expect(store.results.every(({ elapsedMs }) => elapsedMs === 125)).toBe(true)
    expect(store.progress).toBe(100)
  })

  it('clears the previous session when training restarts', () => {
    const store = useTrainingStore()
    store.startTraining(
      () => 0,
      () => 100,
    )
    enterAnswer(store, store.currentQuestion!.answer)
    store.submitAnswer(() => 200)
    store.appendDigit('9')

    store.startTraining(
      () => 0.999,
      () => 500,
    )

    expect(store.currentQuestionNumber).toBe(1)
    expect(store.currentAnswer).toBe('')
    expect(store.results).toHaveLength(0)
    expect(store.isCompleted).toBe(false)
    expect(store.questionStartedAt).toBe(500)
  })
})
