import { describe, expect, it } from 'vitest'

import {
  decodeSharedResult,
  encodeSharedResult,
  MAX_SHARED_ELAPSED_MS,
  type SharedQuestionResult,
  type SharedResultPayload,
} from './sharedResultCodec'

const results: SharedQuestionResult[] = [
  { leftOperand: 2, rightOperand: 3, elapsedMs: 1 },
  { leftOperand: 6, rightOperand: 3, elapsedMs: MAX_SHARED_ELAPSED_MS },
  { leftOperand: 12, rightOperand: 13, elapsedMs: 0x010203 },
  { leftOperand: 21, rightOperand: 23, elapsedMs: 1300 },
  { leftOperand: 28, rightOperand: 34, elapsedMs: 1400 },
  { leftOperand: 48, rightOperand: 34, elapsedMs: 1500 },
  { leftOperand: 51, rightOperand: 50, elapsedMs: 1600 },
  { leftOperand: 62, rightOperand: 40, elapsedMs: 1700 },
  { leftOperand: 68, rightOperand: 43, elapsedMs: 1800 },
  { leftOperand: 78, rightOperand: 33, elapsedMs: 2000 },
]

const basePayload: SharedResultPayload = {
  version: 1,
  playerName: 'Taro',
  results,
}

function base64UrlToBytes(encoded: string): Uint8Array {
  const base64 = encoded.replace(/-/gu, '+').replace(/_/gu, '/')
  const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')
}

function mutateEncoded(
  encoded: string,
  mutate: (bytes: Uint8Array) => Uint8Array = (bytes) => bytes,
): string {
  return bytesToBase64Url(mutate(base64UrlToBytes(encoded)))
}

describe('sharedResultCodec', () => {
  it.each(['Taro', '太郎', 'たつや', '山田 太郎', '広島の父', ''])(
    'encodes and decodes the player name %j and all ten ordered results',
    (playerName) => {
      const payload = { ...basePayload, playerName }
      const decoded = decodeSharedResult(encodeSharedResult(payload))

      expect(decoded).toEqual(payload)
      expect(decoded?.results.map(({ leftOperand }) => leftOperand)).toEqual(
        results.map(({ leftOperand }) => leftOperand),
      )
      expect(decoded?.results.map(({ rightOperand }) => rightOperand)).toEqual(
        results.map(({ rightOperand }) => rightOperand),
      )
      expect(decoded?.results.map(({ elapsedMs }) => elapsedMs)).toEqual(
        results.map(({ elapsedMs }) => elapsedMs),
      )
    },
  )

  it('stores the UTF-8 byte length rather than the JavaScript string length', () => {
    const bytes = base64UrlToBytes(encodeSharedResult({ ...basePayload, playerName: 'たつやA' }))

    expect('たつやA').toHaveLength(4)
    expect(bytes[1]).toBe(10)
    expect(Array.from(bytes.slice(2, 12))).toEqual(Array.from(new TextEncoder().encode('たつやA')))
  })

  it('uses the specified fixed bytes and unsigned 24-bit big-endian order', () => {
    const fixtureResults = Array.from({ length: 10 }, (_, index) => ({
      leftOperand: index === 0 ? 12 : 10,
      rightOperand: index === 0 ? 13 : 20,
      elapsedMs: index === 0 ? 0x010203 : 1,
    }))
    const expectedBytes = Uint8Array.from([
      0x01,
      0x01,
      0x41,
      0x0c,
      0x0d,
      0x01,
      0x02,
      0x03,
      ...Array.from({ length: 9 }, () => [0x0a, 0x14, 0x00, 0x00, 0x01]).flat(),
    ])
    const payload: SharedResultPayload = { version: 1, playerName: 'A', results: fixtureResults }
    const encoded = encodeSharedResult(payload)

    expect(base64UrlToBytes(encoded)).toEqual(expectedBytes)
    expect(decodeSharedResult(bytesToBase64Url(expectedBytes))).toEqual(payload)
  })

  it('rounds fractional performance timings at the codec boundary', () => {
    const fractional = {
      ...basePayload,
      results: results.map((result, index) => ({
        ...result,
        elapsedMs: index === 0 ? 1234.6 : result.elapsedMs,
      })),
    }

    expect(decodeSharedResult(encodeSharedResult(fractional))?.results[0]?.elapsedMs).toBe(1235)
  })

  it('uses URL-safe Base64 without padding', () => {
    expect(encodeSharedResult({ ...basePayload, playerName: '日本語+/=' })).not.toMatch(/[+/=]/u)
  })

  it('keeps the representative Japanese payload compact', () => {
    const encoded = encodeSharedResult({ ...basePayload, playerName: 'たつや' })

    expect(base64UrlToBytes(encoded)).toHaveLength(61)
    expect(encoded).toHaveLength(82)
  })

  it.each([
    ['empty payload', ''],
    ['invalid Base64URL character', 'broken$value'],
    ['invalid Base64URL length', 'A'],
    ['oversized Base64URL input', 'A'.repeat(411)],
  ])('rejects %s', (_name, encoded) => {
    expect(decodeSharedResult(encoded)).toBeNull()
  })

  it.each([
    ['unsupported version', (bytes: Uint8Array) => ((bytes[0] = 2), bytes)],
    ['truncated payload', (bytes: Uint8Array) => bytes.slice(0, -1)],
    ['oversized name length', (bytes: Uint8Array) => ((bytes[1] = 0xff), bytes)],
    ['invalid UTF-8 name', (bytes: Uint8Array) => ((bytes[2] = 0xff), bytes)],
    ['invalid operand', (bytes: Uint8Array) => ((bytes[3] = 0), bytes)],
    [
      'zero elapsedMs',
      (bytes: Uint8Array) => {
        bytes.fill(0, 5, 8)
        return bytes
      },
    ],
    ['trailing garbage', (bytes: Uint8Array) => Uint8Array.from([...bytes, 0])],
    ['only nine questions', (bytes: Uint8Array) => bytes.slice(0, -5)],
    ['eleven questions', (bytes: Uint8Array) => Uint8Array.from([...bytes, 10, 20, 0, 0, 1])],
  ])('rejects binary data with %s', (_name, mutate) => {
    const encoded = encodeSharedResult({ ...basePayload, playerName: 'A' })
    expect(decodeSharedResult(mutateEncoded(encoded, mutate))).toBeNull()
  })

  it('rejects a name length that disagrees with the actual payload', () => {
    const encoded = encodeSharedResult({ ...basePayload, playerName: 'AB' })
    expect(
      decodeSharedResult(
        mutateEncoded(encoded, (bytes) => {
          bytes[1] = 1
          return bytes
        }),
      ),
    ).toBeNull()
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 0, MAX_SHARED_ELAPSED_MS + 1])(
    'rejects invalid elapsedMs %s while encoding',
    (elapsedMs) => {
      const payload = {
        ...basePayload,
        results: results.map((result, index) => (index === 0 ? { ...result, elapsedMs } : result)),
      }

      expect(() => encodeSharedResult(payload)).toThrow(RangeError)
    },
  )

  it.each([
    [9, results.slice(0, 9)],
    [11, [...results, results[0]!]],
  ])('rejects %i results while encoding', (_count, invalidResults) => {
    expect(() => encodeSharedResult({ ...basePayload, results: invalidResults })).toThrow(
      RangeError,
    )
  })

  it('rejects operands outside the training rules while encoding', () => {
    const invalidResults = [{ ...results[0]!, leftOperand: 0 }, ...results.slice(1)]
    expect(() => encodeSharedResult({ ...basePayload, results: invalidResults })).toThrow(
      RangeError,
    )
  })

  it('rejects player names longer than 255 UTF-8 bytes', () => {
    expect(() => encodeSharedResult({ ...basePayload, playerName: 'あ'.repeat(86) })).toThrow(
      RangeError,
    )
  })

  it('does not mutate the source payload', () => {
    const payload = structuredClone(basePayload)
    const before = structuredClone(payload)

    encodeSharedResult(payload)

    expect(payload).toEqual(before)
  })
})
