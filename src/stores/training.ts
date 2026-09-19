import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { generateTrainingQuestions, type RandomSource } from '../domain/training/questionGenerator'
import type { QuestionResult, TrainingQuestion } from '../domain/training/types'

export type Clock = () => number
export type SubmitAnswerResult = 'empty' | 'incorrect' | 'correct' | 'completed'

const performanceClock: Clock = () => performance.now()

export const useTrainingStore = defineStore('training', () => {
  const questions = ref<TrainingQuestion[]>([])
  const currentQuestionIndex = ref(0)
  const currentAnswer = ref('')
  const questionStartedAt = ref<number | null>(null)
  const results = ref<QuestionResult[]>([])
  const isCompleted = ref(false)

  const currentQuestion = computed(() => questions.value[currentQuestionIndex.value])
  const totalQuestions = computed(() => questions.value.length)
  const currentQuestionNumber = computed(() =>
    totalQuestions.value === 0 ? 0 : Math.min(currentQuestionIndex.value + 1, totalQuestions.value),
  )
  const progress = computed(() =>
    totalQuestions.value === 0 ? 0 : (currentQuestionNumber.value / totalQuestions.value) * 100,
  )

  function startTraining(random: RandomSource = Math.random, clock: Clock = performanceClock) {
    questions.value = generateTrainingQuestions(random)
    currentQuestionIndex.value = 0
    currentAnswer.value = ''
    results.value = []
    isCompleted.value = false
    questionStartedAt.value = clock()
  }

  function appendDigit(digit: string) {
    if (/^\d$/.test(digit) && !isCompleted.value) {
      currentAnswer.value += digit
    }
  }

  function deleteLastDigit() {
    currentAnswer.value = currentAnswer.value.slice(0, -1)
  }

  function submitAnswer(clock: Clock = performanceClock): SubmitAnswerResult {
    if (currentAnswer.value === '') {
      return 'empty'
    }

    const question = currentQuestion.value

    if (!question || isCompleted.value) {
      return 'empty'
    }

    if (Number(currentAnswer.value) !== question.answer) {
      currentAnswer.value = ''
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

    if (currentQuestionIndex.value === questions.value.length - 1) {
      isCompleted.value = true
      questionStartedAt.value = null
      return 'completed'
    }

    currentQuestionIndex.value += 1
    questionStartedAt.value = answeredAt
    return 'correct'
  }

  return {
    questions,
    currentQuestionIndex,
    currentAnswer,
    questionStartedAt,
    results,
    isCompleted,
    currentQuestion,
    totalQuestions,
    currentQuestionNumber,
    progress,
    startTraining,
    appendDigit,
    deleteLastDigit,
    submitAnswer,
  }
})
