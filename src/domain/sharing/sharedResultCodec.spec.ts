import { describe, expect, it } from 'vitest'

import {
  decodeSharedResult,
  encodeSharedResult,
  type SharedResultPayload,
} from './sharedResultCodec'

const basePayload: SharedResultPayload = {
  version: 1,
  playerName: 'Taro',
  resultCount: 10,
  totalMs: 12500,
  averageMs: 1250,
  bestMs: 850,
  carryAverageMs: 1400,
  noCarryAverageMs: 1100,
  carryMinusNoCarryMs: 300,
}

function encodeUnknown(value: unknown): string {
  return encodeJson(JSON.stringify(value))
}

function encodeJson(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')
}

describe('sharedResultCodec', () => {
  it.each(['Taro', '太郎', 'たつや', '山田 太郎', '広島の父', ''])(
    'round-trips the player name %j',
    (playerName) => {
      const payload = { ...basePayload, playerName }

      expect(decodeSharedResult(encodeSharedResult(payload))).toEqual(payload)
    },
  )

  it('round-trips nullable analysis values', () => {
    const payload: SharedResultPayload = {
      ...basePayload,
      bestMs: null,
      carryAverageMs: null,
      noCarryAverageMs: null,
      carryMinusNoCarryMs: null,
    }

    expect(decodeSharedResult(encodeSharedResult(payload))).toEqual(payload)
  })

  it('uses URL-safe Base64 without padding', () => {
    expect(encodeSharedResult({ ...basePayload, playerName: '日本語+/=' })).not.toMatch(/[+/=]/u)
  })

  it.each([
    ['', null],
    ['broken$value', null],
    ['A', null],
    [encodeUnknown('not an object'), null],
    [encodeUnknown({ ...basePayload, version: 2 }), null],
    [encodeUnknown({ ...basePayload, totalMs: undefined }), null],
    [encodeUnknown({ ...basePayload, averageMs: '1250' }), null],
    [encodeUnknown({ ...basePayload, bestMs: 'NaN' }), null],
    [encodeJson(JSON.stringify(basePayload).replace('12500', '1e400')), null],
    [encodeUnknown({ ...basePayload, totalMs: -1 }), null],
    [encodeUnknown({ ...basePayload, totalMs: Number.MAX_VALUE }), null],
  ])('rejects malformed or invalid encoded data %#', (encoded, expected) => {
    expect(decodeSharedResult(encoded)).toBe(expected)
  })

  it('rejects valid Base64URL containing invalid JSON', () => {
    const encoded = btoa('{not-json').replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')

    expect(decodeSharedResult(encoded)).toBeNull()
  })

  it('does not mutate the source payload', () => {
    const payload = structuredClone(basePayload)
    const before = structuredClone(payload)

    encodeSharedResult(payload)

    expect(payload).toEqual(before)
  })
})
