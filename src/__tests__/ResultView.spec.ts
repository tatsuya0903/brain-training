import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'

import App from '../App.vue'
import type { QuestionResult } from '../domain/training/types'
import vuetify from '../plugins/vuetify'
import router from '../router'
import { useTrainingStore } from '../stores/training'

const results: QuestionResult[] = [
  {
    questionIndex: 1,
    leftOperand: 2,
    rightOperand: 3,
    correctAnswer: 5,
    elapsedMs: 1000,
    onesCarry: false,
    threeDigits: false,
    category: 'single-digit',
  },
  {
    questionIndex: 3,
    leftOperand: 12,
    rightOperand: 13,
    correctAnswer: 25,
    elapsedMs: 1000,
    onesCarry: false,
    threeDigits: false,
    category: 'two-digit-no-carry',
  },
  {
    questionIndex: 5,
    leftOperand: 28,
    rightOperand: 34,
    correctAnswer: 62,
    elapsedMs: 1500,
    onesCarry: true,
    threeDigits: false,
    category: 'two-digit-carry',
  },
  {
    questionIndex: 6,
    leftOperand: 48,
    rightOperand: 34,
    correctAnswer: 82,
    elapsedMs: 1700,
    onesCarry: true,
    threeDigits: false,
    category: 'two-digit-carry',
  },
]

async function mountResultView(storedResults: QuestionResult[]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const trainingStore = useTrainingStore()
  trainingStore.results = storedResults

  await router.push('/result')
  await router.isReady()

  return mount(App, {
    global: {
      plugins: [pinia, router, vuetify],
    },
  })
}

describe('ResultView', () => {
  beforeEach(async () => {
    await router.push('/')
  })

  it('displays the aggregate, carry comparison, and insight from stored results', async () => {
    const wrapper = await mountResultView(results)

    expect(wrapper.get('[data-testid="total-time"]').text()).toBe('5.20秒')
    expect(wrapper.get('[data-testid="average-time"]').text()).toBe('1.30秒')
    expect(wrapper.get('[data-testid="best-time"]').text()).toBe('1.00秒')
    expect(wrapper.get('[data-testid="no-carry-average"]').text()).toBe('1.00秒')
    expect(wrapper.get('[data-testid="carry-average"]').text()).toBe('1.60秒')
    expect(wrapper.get('[data-testid="carry-difference"]').text()).toBe(
      '繰り上がりありの方が0.60秒長い',
    )
    expect(wrapper.get('[data-testid="insight"]').text()).toContain('繰り上がりありの問題は')
  })

  it('shows a safe empty state when the result route is opened directly', async () => {
    const wrapper = await mountResultView([])

    expect(wrapper.text()).toContain('まだ結果がありません')
    expect(wrapper.get('a').text()).toContain('ホームへ戻る')
  })
})
