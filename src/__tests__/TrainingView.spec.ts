import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
import TrainingView from '../views/TrainingView.vue'
import vuetify from '../plugins/vuetify'
import { CORRECT_FEEDBACK_MS, useTrainingStore } from '../stores/training'

let now: number
let wrapper: VueWrapper
let frameCallbacks: Map<number, FrameRequestCallback>
let nextFrame: number

async function mountTrainingView() {
  const pinia = createPinia()
  const store = useTrainingStore(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/training', component: TrainingView },
      { path: '/result', component: { template: '<div>Result</div>' } },
    ],
  })
  await router.push('/training')
  wrapper = mount(App, { global: { plugins: [pinia, router, vuetify] } })
  await nextTick()
  return { store, router }
}

async function tickFrame(time: number) {
  now = time
  const callbacks = [...frameCallbacks.values()]
  frameCallbacks.clear()
  callbacks.forEach((callback) => callback(time))
  await nextTick()
}

async function tap(name: string) {
  await wrapper.get(`[aria-label="${name}"]`).trigger('click')
}

async function answer(value: number) {
  for (const digit of String(value)) await tap(`${digit}を入力`)
  await tap('回答を決定')
}

function answerText() {
  return wrapper.get('[aria-label="入力中の回答"]').text()
}
function feedbackText() {
  return wrapper.get('[data-testid="answer-feedback"]').text()
}

describe('TrainingView feedback and number pad', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    now = 100
    nextFrame = 0
    frameCallbacks = new Map()
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = ++nextFrame
      frameCallbacks.set(id, callback)
      return id
    })
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id: number) => frameCallbacks.delete(id)),
    )
  })
  afterEach(() => {
    wrapper?.unmount()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('inputs multiple digits and deletes only the last digit', async () => {
    await mountTrainingView()
    await tap('5を入力')
    expect(answerText()).toBe('5')
    await tap('8を入力')
    await tap('3を入力')
    expect(answerText()).toBe('583')
    await tap('1文字削除')
    expect(answerText()).toBe('58')
  })

  it('keeps empty deletion and empty OK harmless without verdict haptics', async () => {
    const vibrate = vi.fn<(pattern: VibratePattern) => boolean>().mockReturnValue(true)
    vi.stubGlobal('navigator', { vibrate })
    const { store } = await mountTrainingView()
    await tap('1文字削除')
    expect(answerText()).toBe('未入力')
    await tap('回答を決定')
    expect(store.results).toHaveLength(0)
    expect(feedbackText()).toBe('')
    expect(vibrate.mock.calls).toEqual([[10]])
  })

  it('renders ten segments and updates from the performance clock, including a long frame gap', async () => {
    const { store } = await mountTrainingView()
    expect(wrapper.findAll('.progress-segment')).toHaveLength(10)
    expect(wrapper.findAll('.progress-segment.active')).toHaveLength(1)
    expect(wrapper.get('.progress-segments').attributes('aria-valuetext')).toBe('1 / 10')
    expect(store.questionStartedAt).toBe(100)
    expect(wrapper.get('[data-testid="elapsed-time"]').text()).toBe('0.0秒')
    await tickFrame(3500)
    expect(wrapper.get('[data-testid="elapsed-time"]').text()).toBe('3.4秒')
    await tickFrame(10100)
    expect(wrapper.get('[data-testid="elapsed-time"]').text()).toBe('10.0秒')
    expect(store.results).toHaveLength(0)
  })

  it('shows incorrect feedback while continuing the same clock and accepting input immediately', async () => {
    const { store } = await mountTrainingView()
    const problem = wrapper.get('[data-testid="problem"]').text()
    await tickFrame(1100)
    await answer(0)
    expect(feedbackText()).toContain('不正解')
    expect(wrapper.get('.answer-display').classes()).toContain('incorrect')
    expect(answerText()).toBe('未入力')
    expect(store.questionStartedAt).toBe(100)
    expect(wrapper.get('[data-testid="problem"]').text()).toBe(problem)
    await tickFrame(2300)
    expect(wrapper.get('[data-testid="elapsed-time"]').text()).toBe('2.2秒')
    await tap('5を入力')
    expect(answerText()).toBe('5')
    expect(feedbackText()).toBe('')
    expect(store.questionStartedAt).toBe(100)
  })

  it('shows exact correct time, blocks input briefly and begins the next clock after DOM update', async () => {
    const { store } = await mountTrainingView()
    now = 3521.25
    await answer(store.currentQuestion!.answer)
    expect(feedbackText()).toContain('正解！')
    expect(wrapper.get('[data-testid="correct-time"]').text()).toBe('3.42秒')
    expect(store.results[0]?.elapsedMs).toBe(3421.25)
    expect(store.questionStartedAt).toBeNull()
    expect(
      wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true)
    await tap('5を入力')
    await tap('回答を決定')
    expect(store.currentAnswer).toBe('')
    expect(store.results).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(CORRECT_FEEDBACK_MS - 1)
    expect(store.currentQuestionNumber).toBe(1)
    const begin = vi
      .spyOn(store, 'beginQuestion')
      .mockImplementation((clock = () => performance.now()) => {
        expect(wrapper.text()).toContain('問題 2 / 10')
        store.questionStartedAt = clock()
      })
    now = 4000
    await vi.advanceTimersByTimeAsync(1)
    expect(begin).toHaveBeenCalledOnce()
    expect(store.currentQuestionNumber).toBe(2)
    expect(store.questionStartedAt).toBe(4000)
    expect(wrapper.findAll('.progress-segment.active')).toHaveLength(2)
    expect(feedbackText()).toBe('')
    now = 4200
    await answer(store.currentQuestion!.answer)
    expect(store.results[1]?.elapsedMs).toBe(200)
  })

  it('shows feedback on the tenth answer before completing and routing to results', async () => {
    const { store, router } = await mountTrainingView()
    for (let number = 1; number <= 10; number += 1) {
      now += 100
      await answer(store.currentQuestion!.answer)
      expect(feedbackText()).toContain('正解！')
      expect(store.isCompleted).toBe(false)
      expect(router.currentRoute.value.path).toBe('/training')
      now += CORRECT_FEEDBACK_MS
      await vi.advanceTimersByTimeAsync(CORRECT_FEEDBACK_MS)
    }
    expect(store.results).toHaveLength(10)
    expect(store.isCompleted).toBe(true)
    expect(router.currentRoute.value.path).toBe('/result')
  })

  it('calls digit, delete and verdict haptics without double vibration for OK', async () => {
    const vibrate = vi.fn<(pattern: VibratePattern) => boolean>().mockReturnValue(true)
    vi.stubGlobal('navigator', { vibrate })
    const { store } = await mountTrainingView()
    await tap('5を入力')
    await tap('1文字削除')
    await answer(0)
    expect(vibrate.mock.calls).toEqual([[10], [10], [10], [[15, 40, 15]]])
    vibrate.mockClear()
    await answer(store.currentQuestion!.answer)
    expect(vibrate.mock.calls).toEqual(
      [...String(store.currentQuestion!.answer)].map(() => [10]).concat([[30]]),
    )
  })

  it('progresses normally when vibration is unsupported', async () => {
    vi.stubGlobal('navigator', {})
    const { store } = await mountTrainingView()
    await answer(0)
    expect(feedbackText()).toContain('不正解')
    await answer(store.currentQuestion!.answer)
    await vi.advanceTimersByTimeAsync(CORRECT_FEEDBACK_MS)
    expect(store.currentQuestionNumber).toBe(2)
  })

  it('cancels old feedback when restarting the session', async () => {
    const { store, router } = await mountTrainingView()
    await answer(store.currentQuestion!.answer)
    now = 900
    store.startTraining()
    await nextTick()
    expect(feedbackText()).toBe('')
    expect(store.questionStartedAt).toBe(900)
    await vi.advanceTimersByTimeAsync(CORRECT_FEEDBACK_MS)
    expect(store.currentQuestionNumber).toBe(1)
    expect(store.results).toHaveLength(0)
    expect(router.currentRoute.value.path).toBe('/training')
  })

  it('cancels the display loop on unmount', async () => {
    await mountTrainingView()
    const cancel = vi.mocked(cancelAnimationFrame)
    wrapper.unmount()
    expect(cancel).toHaveBeenCalled()
  })

  it('cancels pending advancement on unmount', async () => {
    const { store, router } = await mountTrainingView()
    await answer(store.currentQuestion!.answer)
    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(CORRECT_FEEDBACK_MS)
    expect(store.currentQuestionNumber).toBe(1)
    expect(router.currentRoute.value.path).not.toBe('/result')
  })
})
