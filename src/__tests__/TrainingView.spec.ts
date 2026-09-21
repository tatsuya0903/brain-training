import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../App.vue'
import TrainingView from '../views/TrainingView.vue'
import vuetify from '../plugins/vuetify'
import { SOUND_ENABLED_STORAGE_KEY } from '../composables/useSoundPreference'
import { CORRECT_FEEDBACK_MS, useTrainingStore } from '../stores/training'

const soundMocks = vi.hoisted(() => ({
  digit: vi.fn<() => void>(),
  delete: vi.fn<() => void>(),
  submit: vi.fn<() => void>(),
  correct: vi.fn<() => void>(),
  incorrect: vi.fn<() => void>(),
}))

vi.mock('../domain/training/sounds', () => ({
  createTrainingSoundPlayer: (isEnabled: () => boolean) => ({
    playDigitSound: () => isEnabled() && soundMocks.digit(),
    playDeleteSound: () => isEnabled() && soundMocks.delete(),
    playSubmitSound: () => isEnabled() && soundMocks.submit(),
    playCorrectSound: () => isEnabled() && soundMocks.correct(),
    playIncorrectSound: () => isEnabled() && soundMocks.incorrect(),
  }),
}))

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

async function pressKey(
  key: string,
  init: Omit<KeyboardEventInit, 'key'> = {},
  target: EventTarget = window,
) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  await nextTick()
  return event
}

async function typeAnswer(value: number, numpad = false) {
  for (const digit of String(value)) {
    await pressKey(digit, { code: numpad ? `Numpad${digit}` : `Digit${digit}` })
  }
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
    localStorage.clear()
    for (const sound of Object.values(soundMocks)) sound.mockReset()
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

  it('accepts every regular digit key', async () => {
    await mountTrainingView()

    for (const digit of '0123456789') {
      const event = await pressKey(digit, { code: `Digit${digit}` })
      expect(event.defaultPrevented).toBe(true)
    }

    expect(answerText()).toBe('0123456789')
    expect(soundMocks.digit).toHaveBeenCalledTimes(10)
  })

  it('accepts every numpad digit key through the same digit mapping', async () => {
    await mountTrainingView()

    for (const digit of '0123456789') {
      const event = await pressKey(digit, { code: `Numpad${digit}` })
      expect(event.defaultPrevented).toBe(true)
    }

    expect(answerText()).toBe('0123456789')
    expect(soundMocks.digit).toHaveBeenCalledTimes(10)
  })

  it.each([
    ['regular Enter', 'Enter'],
    ['numpad Enter', 'NumpadEnter'],
  ])('submits the answer with %s', async (_label, code) => {
    const { store } = await mountTrainingView()
    await typeAnswer(store.currentQuestion!.answer, code === 'NumpadEnter')

    const event = await pressKey('Enter', { code })

    expect(event.defaultPrevented).toBe(true)
    expect(store.results).toHaveLength(1)
    expect(feedbackText()).toContain('正解！')
    expect(soundMocks.submit).toHaveBeenCalledOnce()
    expect(soundMocks.correct).toHaveBeenCalledOnce()
    expect(soundMocks.incorrect).not.toHaveBeenCalled()
  })

  it('handles Backspace and ignores repeated digit, Enter, and Backspace events', async () => {
    const { store } = await mountTrainingView()
    await pressKey('7', { code: 'Digit7' })
    await pressKey('5', { code: 'Digit5' })
    await pressKey('3', { code: 'Digit3' })
    for (const sound of Object.values(soundMocks)) sound.mockClear()

    expect((await pressKey('1', { code: 'Digit1', repeat: true })).defaultPrevented).toBe(true)
    expect((await pressKey('Enter', { code: 'Enter', repeat: true })).defaultPrevented).toBe(true)
    expect(
      (await pressKey('Backspace', { code: 'Backspace', repeat: true })).defaultPrevented,
    ).toBe(true)
    expect(answerText()).toBe('753')
    expect(store.results).toHaveLength(0)
    expect(soundMocks.digit).not.toHaveBeenCalled()
    expect(soundMocks.submit).not.toHaveBeenCalled()
    expect(soundMocks.delete).not.toHaveBeenCalled()

    const backspace = await pressKey('Backspace', { code: 'Backspace' })
    expect(backspace.defaultPrevented).toBe(true)
    expect(answerText()).toBe('75')
    expect(soundMocks.delete).toHaveBeenCalledOnce()
  })

  it('keeps empty Enter harmless and leaves unrelated and text-input keys alone', async () => {
    const { store } = await mountTrainingView()

    expect((await pressKey('Enter', { code: 'Enter' })).defaultPrevented).toBe(true)
    expect(store.results).toHaveLength(0)
    expect(store.currentQuestionNumber).toBe(1)
    expect(store.questionStartedAt).toBe(100)
    expect(feedbackText()).toBe('')
    expect(soundMocks.submit).not.toHaveBeenCalled()
    expect(soundMocks.correct).not.toHaveBeenCalled()
    expect(soundMocks.incorrect).not.toHaveBeenCalled()
    expect((await pressKey('a', { code: 'KeyA' })).defaultPrevented).toBe(false)

    const input = document.createElement('input')
    document.body.append(input)
    const inputEvent = await pressKey('7', { code: 'Digit7' }, input)
    input.remove()
    expect(inputEvent.defaultPrevented).toBe(false)
    expect(answerText()).toBe('未入力')
  })

  it('blocks all keyboard actions during correct feedback without queuing next input', async () => {
    const { store } = await mountTrainingView()
    await typeAnswer(store.currentQuestion!.answer)
    await pressKey('Enter', { code: 'Enter' })
    expect(feedbackText()).toContain('正解！')
    for (const sound of Object.values(soundMocks)) sound.mockClear()

    const appendDigit = vi.spyOn(store, 'appendDigit')
    const deleteLastDigit = vi.spyOn(store, 'deleteLastDigit')
    const submitAnswer = vi.spyOn(store, 'submitAnswer')
    await pressKey('1', { code: 'Digit1' })
    await pressKey('Enter', { code: 'Enter' })
    await pressKey('Backspace', { code: 'Backspace' })

    expect(appendDigit).not.toHaveBeenCalled()
    expect(deleteLastDigit).not.toHaveBeenCalled()
    expect(submitAnswer).not.toHaveBeenCalled()
    expect(store.currentAnswer).toBe('')
    expect(store.results).toHaveLength(1)
    expect(soundMocks.digit).not.toHaveBeenCalled()
    expect(soundMocks.delete).not.toHaveBeenCalled()
    expect(soundMocks.submit).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(CORRECT_FEEDBACK_MS)
    expect(store.currentQuestionNumber).toBe(2)
    expect(store.currentAnswer).toBe('')
  })

  it('allows immediate keyboard retry after an incorrect answer', async () => {
    const { store } = await mountTrainingView()
    const question = wrapper.get('[data-testid="problem"]').text()
    const startedAt = store.questionStartedAt
    await pressKey('0', { code: 'Digit0' })
    await pressKey('Enter', { code: 'Enter' })

    expect(feedbackText()).toContain('不正解')
    expect(store.currentAnswer).toBe('')
    expect(store.questionStartedAt).toBe(startedAt)
    expect(wrapper.get('[data-testid="problem"]').text()).toBe(question)

    await typeAnswer(store.currentQuestion!.answer, true)
    await pressKey('Enter', { code: 'NumpadEnter' })
    expect(feedbackText()).toContain('正解！')
    expect(store.results).toHaveLength(1)
  })

  it('uses the same handlers for keyboard and NumberPad without adding keyboard haptics', async () => {
    const vibrate = vi.fn<(pattern: VibratePattern) => boolean>().mockReturnValue(true)
    vi.stubGlobal('navigator', { vibrate })
    await mountTrainingView()

    await pressKey('7', { code: 'Digit7' })
    await tap('5を入力')
    await pressKey('Backspace', { code: 'Backspace' })
    await tap('3を入力')

    expect(answerText()).toBe('73')
    expect(vibrate.mock.calls).toEqual([[10], [10]])
  })

  it('removes the listener on unmount and does not duplicate it after remount', async () => {
    const first = await mountTrainingView()
    wrapper.unmount()
    await pressKey('4', { code: 'Digit4' })
    expect(first.store.currentAnswer).toBe('')

    const second = await mountTrainingView()
    const appendDigit = vi.spyOn(second.store, 'appendDigit')
    await pressKey('4', { code: 'Digit4' })
    expect(appendDigit).toHaveBeenCalledOnce()
    expect(second.store.currentAnswer).toBe('4')
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
    expect(soundMocks.digit).toHaveBeenCalledTimes(3)
    expect(soundMocks.delete).toHaveBeenCalledOnce()
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
    expect(soundMocks.delete).not.toHaveBeenCalled()
    expect(soundMocks.submit).not.toHaveBeenCalled()
    expect(soundMocks.correct).not.toHaveBeenCalled()
    expect(soundMocks.incorrect).not.toHaveBeenCalled()
  })

  it('plays submit plus the matching verdict sound for accepted on-screen answers', async () => {
    const { store } = await mountTrainingView()
    await tap('0を入力')
    for (const sound of Object.values(soundMocks)) sound.mockClear()
    await tap('回答を決定')

    expect(soundMocks.submit).toHaveBeenCalledOnce()
    expect(soundMocks.incorrect).toHaveBeenCalledOnce()
    expect(soundMocks.correct).not.toHaveBeenCalled()

    for (const digit of String(store.currentQuestion!.answer)) await tap(`${digit}を入力`)
    for (const sound of Object.values(soundMocks)) sound.mockClear()
    await tap('回答を決定')

    expect(soundMocks.submit).toHaveBeenCalledOnce()
    expect(soundMocks.correct).toHaveBeenCalledOnce()
    expect(soundMocks.incorrect).not.toHaveBeenCalled()
  })

  it('toggles all sounds with an accessible persisted control', async () => {
    const { store } = await mountTrainingView()
    const disable = wrapper.get('[aria-label="効果音をオフにする"]')
    expect(disable.attributes('aria-pressed')).toBe('true')

    await disable.trigger('click')
    const enable = wrapper.get('[aria-label="効果音をオンにする"]')
    expect(enable.attributes('aria-pressed')).toBe('false')
    expect(localStorage.getItem(SOUND_ENABLED_STORAGE_KEY)).toBe('false')

    await tap('5を入力')
    await tap('1文字削除')
    await tap('0を入力')
    await tap('回答を決定')
    expect(feedbackText()).toContain('不正解')
    for (const sound of Object.values(soundMocks)) expect(sound).not.toHaveBeenCalled()

    for (const digit of String(store.currentQuestion!.answer)) await tap(`${digit}を入力`)
    await tap('回答を決定')
    expect(feedbackText()).toContain('正解！')
    for (const sound of Object.values(soundMocks)) expect(sound).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(CORRECT_FEEDBACK_MS)

    await enable.trigger('click')
    expect(wrapper.get('[aria-label="効果音をオフにする"]').attributes('aria-pressed')).toBe('true')
    expect(localStorage.getItem(SOUND_ENABLED_STORAGE_KEY)).toBe('true')
    await tap(`${String(store.currentQuestion!.answer)[0]}を入力`)
    expect(soundMocks.digit).toHaveBeenCalledOnce()
  })

  it('restores the saved sound preference on mount', async () => {
    localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, 'false')
    await mountTrainingView()

    expect(wrapper.get('[aria-label="効果音をオンにする"]').attributes('aria-pressed')).toBe(
      'false',
    )
    await tap('7を入力')
    expect(soundMocks.digit).not.toHaveBeenCalled()
  })

  it('keeps the toggle usable when localStorage access fails', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    await expect(mountTrainingView()).resolves.toBeDefined()
    await wrapper.get('[aria-label="効果音をオフにする"]').trigger('click')
    expect(wrapper.get('[aria-label="効果音をオンにする"]').attributes('aria-pressed')).toBe(
      'false',
    )
  })

  it('continues game flow if every requested sound throws', async () => {
    for (const sound of Object.values(soundMocks)) {
      sound.mockImplementation(() => {
        throw new Error('audio failure')
      })
    }
    const { store } = await mountTrainingView()

    for (const digit of String(store.currentQuestion!.answer)) await tap(`${digit}を入力`)
    await tap('回答を決定')
    expect(feedbackText()).toContain('正解！')
    expect(store.results).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(CORRECT_FEEDBACK_MS)
    expect(store.currentQuestionNumber).toBe(2)
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
      wrapper
        .get('[aria-label="回答テンキー"]')
        .findAll('button')
        .every((button) => button.attributes('disabled') !== undefined),
    ).toBe(true)
    for (const sound of Object.values(soundMocks)) sound.mockClear()
    await tap('5を入力')
    await tap('回答を決定')
    expect(store.currentAnswer).toBe('')
    expect(store.results).toHaveLength(1)
    expect(soundMocks.digit).not.toHaveBeenCalled()
    expect(soundMocks.submit).not.toHaveBeenCalled()
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
