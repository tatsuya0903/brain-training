import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'

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

const sharedPayload: SharedResultPayload = {
  version: 1,
  playerName: '山田 太郎',
  resultCount: 10,
  totalMs: 12000,
  averageMs: 1200,
  bestMs: 800,
  carryAverageMs: 1400,
  noCarryAverageMs: 1000,
  carryMinusNoCarryMs: 400,
}

async function mountResultView(storedResults: QuestionResult[], share?: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const trainingStore = useTrainingStore()
  trainingStore.results = storedResults

  await router.push({ path: '/result', query: share === undefined ? {} : { share } })
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

  afterEach(() => {
    vi.unstubAllGlobals()
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
    expect(wrapper.get('input')).toBeTruthy()
    expect(wrapper.get('button').text()).toBeTruthy()
  })

  it('shows a safe empty state when the result route is opened directly', async () => {
    const wrapper = await mountResultView([])

    expect(wrapper.text()).toContain('まだ結果がありません')
    expect(wrapper.get('a').text()).toContain('ホームへ戻る')
  })

  it('lets the player enter a name in the sharing UI', async () => {
    const wrapper = await mountResultView(results)
    const input = wrapper.get('input')

    await input.setValue('たつや')

    expect((input.element as HTMLInputElement).value).toBe('たつや')
    expect(wrapper.get('button[type="button"]')).toBeTruthy()
    expect(wrapper.text()).toContain('成績を共有')
  })

  it('displays a Japanese-named shared result without store results', async () => {
    const wrapper = await mountResultView([], encodeSharedResult(sharedPayload))

    expect(wrapper.get('[data-testid="shared-result-heading"]').text()).toBe('山田 太郎さんの結果')
    expect(wrapper.get('[data-testid="total-time"]').text()).toBe('12.00秒')
    expect(wrapper.get('[data-testid="average-time"]').text()).toBe('1.20秒')
    expect(wrapper.get('[data-testid="best-time"]').text()).toBe('0.80秒')
    expect(wrapper.get('[data-testid="carry-difference"]').text()).toContain('0.40秒長い')
    expect(wrapper.text()).not.toContain('成績を共有')
    expect(wrapper.text()).toContain('もう一度挑戦する')
  })

  it('uses a natural heading when the shared player name is empty', async () => {
    const wrapper = await mountResultView(
      [],
      encodeSharedResult({ ...sharedPayload, playerName: '' }),
    )

    expect(wrapper.get('[data-testid="shared-result-heading"]').text()).toBe('共有された結果')
  })

  it.each(['broken-value', encodeInvalidPayload({ ...sharedPayload, version: 2 })])(
    'shows a safe error for an invalid or unsupported share parameter',
    async (share) => {
      const wrapper = await mountResultView([], share)

      expect(wrapper.get('[data-testid="share-error"]').text()).toContain(
        'この共有データは読み込めません',
      )
      expect(wrapper.text()).toContain('ホームへ戻る')
    },
  )

  it('uses Web Share with the displayed analysis and player name', async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined)
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })
    const wrapper = await mountResultView(results)

    await wrapper.get('input').setValue('太郎')
    await wrapper.get('[data-testid="share-button"]').trigger('click')
    await flushPromises()

    expect(share).toHaveBeenCalledOnce()
    expect(writeText).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('成績を共有しました')
    const sharedUrlValue = share.mock.calls[0]![0].url
    expect(sharedUrlValue).toEqual(expect.any(String))

    if (typeof sharedUrlValue !== 'string') {
      throw new TypeError('Web Share URL was not a string')
    }

    const sharedUrl = new URL(sharedUrlValue)
    expect(sharedUrl.hash).toContain('#/result?share=')
    const decoded = decodeShareFromUrl(sharedUrl)
    expect(decoded).toMatchObject({ playerName: '太郎', totalMs: 5200, averageMs: 1300 })
  })

  it('falls back to Clipboard and shows success feedback', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const wrapper = await mountResultView(results)

    await wrapper.get('[data-testid="share-button"]').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('共有URLをコピーしました')
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

    await wrapper.get('[data-testid="share-button"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('共有できませんでした')
  })
})

function encodeInvalidPayload(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')
}

function decodeShareFromUrl(url: URL) {
  const hashQuery = url.hash.split('?')[1]
  const encoded = new URLSearchParams(hashQuery).get('share')

  expect(encoded).not.toBeNull()
  return decodeSharedResult(encoded!)
}
