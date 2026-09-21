import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'

import App from '../App.vue'
import {
  decodeSharedResult,
  encodeSharedResult,
  type SharedResultPayload,
} from '../domain/sharing/sharedResultCodec'
import type { QuestionResult } from '../domain/training/types'
import vuetify from '../plugins/vuetify'
import router from '../router'
import { useTrainingStore } from '../stores/training'

function result(
  questionIndex: number,
  elapsedMs: number,
  overrides: Partial<QuestionResult> = {},
): QuestionResult {
  return {
    questionIndex,
    leftOperand: 10 + questionIndex,
    rightOperand: 20 + questionIndex,
    correctAnswer: 30 + questionIndex * 2,
    elapsedMs,
    onesCarry: false,
    threeDigits: false,
    category: 'two-digit-no-carry',
    ...overrides,
  }
}

const results: QuestionResult[] = [
  result(1, 1000, {
    leftOperand: 2,
    rightOperand: 3,
    correctAnswer: 5,
    category: 'single-digit',
  }),
  result(2, 1100, {
    leftOperand: 6,
    rightOperand: 3,
    correctAnswer: 9,
    category: 'single-digit',
  }),
  result(3, 1200, { leftOperand: 12, rightOperand: 13, correctAnswer: 25 }),
  result(4, 1300, { leftOperand: 21, rightOperand: 23, correctAnswer: 44 }),
  result(5, 1400, {
    leftOperand: 28,
    rightOperand: 34,
    correctAnswer: 62,
    onesCarry: true,
    category: 'two-digit-carry',
  }),
  result(6, 1500, {
    leftOperand: 48,
    rightOperand: 34,
    correctAnswer: 82,
    onesCarry: true,
    category: 'two-digit-carry',
  }),
  result(7, 1600, {
    leftOperand: 51,
    rightOperand: 50,
    correctAnswer: 101,
    threeDigits: true,
    category: 'three-digit-no-ones-carry',
  }),
  result(8, 1700, {
    leftOperand: 62,
    rightOperand: 40,
    correctAnswer: 102,
    threeDigits: true,
    category: 'three-digit-no-ones-carry',
  }),
  result(9, 1800, {
    leftOperand: 68,
    rightOperand: 43,
    correctAnswer: 111,
    onesCarry: true,
    threeDigits: true,
    category: 'three-digit-ones-carry',
  }),
  result(10, 2000, {
    leftOperand: 78,
    rightOperand: 33,
    correctAnswer: 111,
    onesCarry: true,
    threeDigits: true,
    category: 'three-digit-ones-carry',
  }),
]

const sharedPayload: SharedResultPayload = {
  version: 1,
  playerName: '山田 太郎',
  results: results.map(({ leftOperand, rightOperand, elapsedMs }) => ({
    leftOperand,
    rightOperand,
    elapsedMs,
  })),
}

let mountedWrappers: VueWrapper[] = []

async function mountResultView(storedResults: QuestionResult[], sharedResult?: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const trainingStore = useTrainingStore()
  trainingStore.results = storedResults

  await router.push({
    path: '/result',
    query: sharedResult === undefined ? {} : { s: sharedResult },
  })
  await router.isReady()

  const wrapper = mount(App, {
    attachTo: document.body,
    global: {
      plugins: [pinia, router, vuetify],
    },
  })
  mountedWrappers.push(wrapper)
  return wrapper
}

describe('ResultView', () => {
  beforeEach(async () => {
    mountedWrappers = []
    vi.stubGlobal('visualViewport', {
      width: 1024,
      height: 768,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
      addEventListener:
        vi.fn<(type: string, listener: EventListenerOrEventListenerObject) => void>(),
      removeEventListener:
        vi.fn<(type: string, listener: EventListenerOrEventListenerObject) => void>(),
    })
    await router.push('/')
  })

  afterEach(() => {
    for (const wrapper of mountedWrappers) wrapper.unmount()
    vi.unstubAllGlobals()
  })

  function body() {
    return new DOMWrapper(document.body)
  }

  it('makes total time primary and shows median as the usual speed plus best', async () => {
    const wrapper = await mountResultView(results)

    expect(wrapper.get('[data-testid="primary-metric"] [data-testid="total-time"]').text()).toBe(
      '14.60秒',
    )
    expect(wrapper.get('[data-testid="typical-time"]').text()).toBe('1.45秒')
    expect(wrapper.get('[data-testid="best-time"]').text()).toBe('1.00秒')
    expect(wrapper.text()).toContain('合計タイム')
    expect(wrapper.text()).toContain('いつもの速さ')
    expect(wrapper.text()).toContain('ベスト')
    expect(wrapper.text()).not.toContain('平均回答時間')
    expect(wrapper.get('[data-testid="primary-metric"]').classes()).toContain('total-metric')
  })

  it('shows the existing app icon and a compact accessible share action in the header', async () => {
    const wrapper = await mountResultView(results)
    const header = wrapper.get('.result-header')
    const icon = header.get('[data-testid="app-icon"]')
    const shareButton = header.get('[data-testid="open-share-button"]')

    expect(icon.attributes('src')).toContain('pwa-192x192.png')
    expect(shareButton.attributes('aria-label')).toBe('成績を共有')
    expect(shareButton.classes()).toContain('share-activator')
  })

  it('shows a compact carry trend only when carry questions are clearly slower', async () => {
    const wrapper = await mountResultView(results)

    expect(wrapper.get('[data-testid="carry-trend"]').text()).toContain('今回の傾向')
    expect(wrapper.get('[data-testid="carry-difference"]').text()).toContain('0.23秒 遅めでした')
  })

  it('hides the carry trend when carry questions are faster', async () => {
    const fasterCarryResults = results.map((item) =>
      item.onesCarry ? { ...item, elapsedMs: item.questionIndex * 50 } : item,
    )
    const wrapper = await mountResultView(fasterCarryResults)

    expect(wrapper.find('[data-testid="carry-trend"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('今回の傾向')
  })

  it('hides the carry trend when the averages are nearly the same', async () => {
    const similarCarryTimes = new Map([
      [5, 1300],
      [6, 1400],
      [9, 1500],
      [10, 1600],
    ])
    const similarResults = results.map((item) => ({
      ...item,
      elapsedMs: similarCarryTimes.get(item.questionIndex) ?? item.elapsedMs,
    }))
    const wrapper = await mountResultView(similarResults)

    expect(wrapper.find('[data-testid="carry-trend"]').exists()).toBe(false)
  })

  it('keeps details collapsed initially and expands all ten expressions, times, and bars', async () => {
    const wrapper = await mountResultView(results)
    const toggle = wrapper.get('[data-testid="details-toggle"]')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.findAll('[data-testid="detail-row"]')).toHaveLength(0)

    await toggle.trigger('click')
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="detail-row"]')
    const bars = wrapper.findAll('[data-testid="detail-bar"]')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(rows).toHaveLength(10)
    expect(bars).toHaveLength(10)
    expect(rows[0]?.text()).toContain('2 + 3')
    expect(rows[0]?.text()).toContain('1.00秒')
    expect(rows[9]?.text()).toContain('78 + 33')
    expect(rows[9]?.text()).toContain('2.00秒')
    expect(bars[0]?.attributes('data-bar-width')).toBe('50')
    expect(bars[0]?.attributes('style')).toContain('width: 50%')
    expect(bars[9]?.attributes('data-bar-width')).toBe('100')
    expect(bars[9]?.attributes('style')).toContain('width: 100%')
  })

  it('shows a safe empty state when the result route is opened directly', async () => {
    const wrapper = await mountResultView([])

    expect(wrapper.text()).toContain('まだ結果がありません')
    expect(wrapper.get('a').text()).toContain('ホームへ戻る')
    expect(wrapper.find('[data-testid="app-icon"]').exists()).toBe(true)
  })

  it('opens the existing sharing dialog from the header and accepts a player name', async () => {
    const wrapper = await mountResultView(results)
    await wrapper.get('[data-testid="open-share-button"]').trigger('click')
    await flushPromises()
    const input = body().get('input')

    await input.setValue('たつや')

    expect((input.element as HTMLInputElement).value).toBe('たつや')
    expect(body().get('[role="dialog"]').text()).toContain('成績を共有')
    expect(body().text()).toContain('共有URLは暗号化されておらず')
  })

  it('reconstructs and analyzes a binary shared result with the same summary and details', async () => {
    const wrapper = await mountResultView([], encodeSharedResult(sharedPayload))

    expect(wrapper.get('[data-testid="shared-result-heading"]').text()).toBe('山田 太郎さんの結果')
    expect(wrapper.get('[data-testid="total-time"]').text()).toBe('14.60秒')
    expect(wrapper.get('[data-testid="typical-time"]').text()).toBe('1.45秒')
    expect(wrapper.get('[data-testid="best-time"]').text()).toBe('1.00秒')
    expect(wrapper.text()).toContain('いつもの速さ')
    expect(wrapper.get('[data-testid="carry-difference"]').text()).toContain('0.23秒 遅めでした')
    expect(wrapper.find('[data-testid="open-share-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="app-icon"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('もう一度挑戦する')

    await wrapper.get('[data-testid="details-toggle"]').trigger('click')
    await flushPromises()
    const rows = wrapper.findAll('[data-testid="detail-row"]')
    expect(rows).toHaveLength(10)
    for (const [index, row] of rows.entries()) {
      expect(row.text()).toContain(
        `${results[index]?.leftOperand} + ${results[index]?.rightOperand}`,
      )
      expect(row.text()).toContain(`${((results[index]?.elapsedMs ?? 0) / 1000).toFixed(2)}秒`)
    }
  })

  it('uses a natural heading when the shared player name is empty', async () => {
    const wrapper = await mountResultView(
      [],
      encodeSharedResult({ ...sharedPayload, playerName: '' }),
    )

    expect(wrapper.get('[data-testid="shared-result-heading"]').text()).toBe('共有された結果')
  })

  it.each(['broken-value', encodeInvalidVersion(sharedPayload)])(
    'shows a safe error for an invalid or unsupported share parameter',
    async (share) => {
      const wrapper = await mountResultView([], share)

      expect(wrapper.get('[data-testid="share-error"]').text()).toContain(
        'この共有データは読み込めません',
      )
      expect(wrapper.text()).toContain('ホームへ戻る')
    },
  )

  it('uses Web Share with the binary version 1 payload and player name', async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined)
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })
    const wrapper = await mountResultView(results)

    await wrapper.get('[data-testid="open-share-button"]').trigger('click')
    await flushPromises()
    await body().get('input').setValue('太郎')
    await body().get('[data-testid="share-button"]').trigger('click')
    await flushPromises()

    expect(share).toHaveBeenCalledOnce()
    expect(writeText).not.toHaveBeenCalled()
    expect(body().text()).toContain('成績を共有しました')
    const sharedUrlValue = share.mock.calls[0]![0].url
    expect(sharedUrlValue).toEqual(expect.any(String))

    if (typeof sharedUrlValue !== 'string') {
      throw new TypeError('Web Share URL was not a string')
    }

    const sharedUrl = new URL(sharedUrlValue)
    expect(sharedUrl.hash).toContain('#/result?s=')
    expect(sharedUrl.hash).not.toContain('?share=')
    const decoded = decodeShareFromUrl(sharedUrl)
    expect(decoded).toMatchObject({
      version: 1,
      playerName: '太郎',
    })
    expect(decoded?.results).toHaveLength(10)
    expect(decoded).not.toHaveProperty('totalMs')
    expect(decoded).not.toHaveProperty('averageMs')
    expect(decoded).not.toHaveProperty('medianMs')
  })

  it('falls back to Clipboard and shows success feedback', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = await mountResultView(results)
    await wrapper.get('[data-testid="open-share-button"]').trigger('click')
    await flushPromises()

    await body().get('[data-testid="share-button"]').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledOnce()
    expect(body().text()).toContain('共有URLをコピーしました')
  })

  it('does not show a fatal error when the share sheet is cancelled', async () => {
    const share = vi
      .fn<(data: ShareData) => Promise<void>>()
      .mockRejectedValue(new DOMException('Cancelled', 'AbortError'))
    vi.stubGlobal('navigator', {
      share,
      clipboard: { writeText: vi.fn<(text: string) => Promise<void>>() },
    })
    const wrapper = await mountResultView(results)
    await wrapper.get('[data-testid="open-share-button"]').trigger('click')
    await flushPromises()

    await body().get('[data-testid="share-button"]').trigger('click')
    await flushPromises()

    expect(body().text()).not.toContain('共有できませんでした')
  })

  it('blocks names that exceed 255 UTF-8 bytes before sharing', async () => {
    const wrapper = await mountResultView(results)
    await wrapper.get('[data-testid="open-share-button"]').trigger('click')
    await flushPromises()

    await body().get('input').setValue('あ'.repeat(86))
    await flushPromises()

    expect(body().get('[data-testid="share-button"]').attributes('disabled')).toBeDefined()
    expect(body().text()).toContain('255 bytes以内')
  })

  it('ignores the removed legacy share query without crashing', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    await router.push({ path: '/result', query: { share: 'legacy-json-value' } })
    await router.isReady()
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { plugins: [pinia, router, vuetify] },
    })
    mountedWrappers.push(wrapper)

    expect(wrapper.text()).toContain('まだ結果がありません')
    expect(wrapper.find('[data-testid="share-error"]').exists()).toBe(false)
  })
})

function encodeInvalidVersion(payload: SharedResultPayload): string {
  const encoded = encodeSharedResult(payload)
  const base64 = encoded.replace(/-/gu, '+').replace(/_/gu, '/')
  const decodedBinary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
  const bytes = Uint8Array.from(decodedBinary, (character) => character.charCodeAt(0))
  bytes[0] = 2
  let encodedBinary = ''

  for (const byte of bytes) {
    encodedBinary += String.fromCharCode(byte)
  }

  return btoa(encodedBinary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')
}

function decodeShareFromUrl(url: URL) {
  const hashQuery = url.hash.split('?')[1]
  const encoded = new URLSearchParams(hashQuery).get('s')

  expect(encoded).not.toBeNull()
  return decodeSharedResult(encoded!)
}
