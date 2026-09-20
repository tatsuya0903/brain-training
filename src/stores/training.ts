import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { generateTrainingQuestions, type RandomSource } from '../domain/training/questionGenerator'
import type { QuestionResult, TrainingQuestion } from '../domain/training/types'

export type Clock = () => number
export type SubmitAnswerResult = 'empty' | 'incorrect' | 'correct'
export const CORRECT_FEEDBACK_MS = 350

const performanceClock: Clock = () => performance.now()

export const useTrainingStore = defineStore('training', () => {
  const questions = ref<TrainingQuestion[]>([])
  const currentQuestionIndex = ref(0)
  const currentAnswer = ref('')
  const questionStartedAt = ref<number | null>(null)
  const results = ref<QuestionResult[]>([])
  const isCompleted = ref(false)
  const feedback = ref<'correct' | 'incorrect' | null>(null)
  const canAnswer = computed(
    () => questionStartedAt.value !== null && !isCompleted.value && feedback.value !== 'correct',
  )
  const correctElapsedMs = computed(() =>
    feedback.value === 'correct'
      ? (results.value[results.value.length - 1]?.elapsedMs ?? null)
      : null,
  )

  const currentQuestion = computed(() => questions.value[currentQuestionIndex.value])
  const totalQuestions = computed(() => questions.value.length)
  const currentQuestionNumber = computed(() =>
    totalQuestions.value === 0 ? 0 : Math.min(currentQuestionIndex.value + 1, totalQuestions.value),
  )
  const progress = computed(() =>
    totalQuestions.value === 0 ? 0 : (currentQuestionNumber.value / totalQuestions.value) * 100,
  )

  function startTraining(random: RandomSource = Math.random) {
    questions.value = generateTrainingQuestions(random)
    currentQuestionIndex.value = 0
    currentAnswer.value = ''
    results.value = []
    isCompleted.value = false
    feedback.value = null
    questionStartedAt.value = null
  }

  // The view starts the clock only after the current problem has been rendered.
  function beginQuestion(clock: Clock = performanceClock) {
    if (
      currentQuestion.value &&
      !isCompleted.value &&
      feedback.value !== 'correct' &&
      questionStartedAt.value === null
    ) {
      questionStartedAt.value = clock()
    }
  }

  function appendDigit(digit: string) {
    if (/^\d$/.test(digit) && canAnswer.value) {
      feedback.value = null
      currentAnswer.value += digit
    }
  }

  function deleteLastDigit() {
    if (!canAnswer.value) return
    feedback.value = null
    currentAnswer.value = currentAnswer.value.slice(0, -1)
  }

  function submitAnswer(clock: Clock = performanceClock): SubmitAnswerResult {
    if (!canAnswer.value || currentAnswer.value === '') {
      return 'empty'
    }

    const question = currentQuestion.value

    if (!question || isCompleted.value) {
      return 'empty'
    }

    if (Number(currentAnswer.value) !== question.answer) {
      currentAnswer.value = ''
      feedback.value = 'incorrect'
      return 'incorrect'
    }

    const answeredAt = clock()
    const startedAt = questionStartedAt.value ?? answeredAt

    results.value.push({
      questionIndex: question.questionIndex,
      leftOperand: question.leftOperand,
      rightOperand: question.rightOperand,
      correctAnswer: question.answer,
      elapsedMs: answeredAt - startedAt,
      onesCarry: question.onesCarry,
      threeDigits: question.threeDigits,
      category: question.category,
    })
    currentAnswer.value = ''
    questionStartedAt.value = null
    feedback.value = 'correct'
    return 'correct'
  }

  function advanceAfterFeedback(): 'next' | 'completed' | 'ignored' {
    if (feedback.value !== 'correct') return 'ignored'
    feedback.value = null

    if (currentQuestionIndex.value === questions.value.length - 1) {
      isCompleted.value = true
      questionStartedAt.value = null
      return 'completed'
    }

    currentQuestionIndex.value += 1
    return 'next'
  }

  return {
    questions,
    currentQuestionIndex,
    currentAnswer,
    questionStartedAt,
    results,
    isCompleted,
    feedback,
    canAnswer,
    correctElapsedMs,
    currentQuestion,
    totalQuestions,
    currentQuestionNumber,
    progress,
    startTraining,
    beginQuestion,
    advanceAfterFeedback,
    appendDigit,
    deleteLastDigit,
    submitAnswer,
  }
})
