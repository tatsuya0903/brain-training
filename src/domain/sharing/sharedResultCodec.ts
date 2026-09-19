export const SHARED_RESULT_VERSION = 1 as const

const MAX_ENCODED_LENGTH = 4096
export const MAX_PLAYER_NAME_LENGTH = 100

export interface SharedResultPayload {
  version: typeof SHARED_RESULT_VERSION
  playerName: string
  resultCount: number
  totalMs: number
  averageMs: number
  bestMs: number | null
  carryAverageMs: number | null
  noCarryAverageMs: number | null
  carryMinusNoCarryMs: number | null
}

function isSafeNonNegativeNumber(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value <= Number.MAX_SAFE_INTEGER &&
    value >= 0
  )
}

function isSafeNumber(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= Number.MAX_SAFE_INTEGER
  )
}

function isNullableNonNegativeNumber(value: unknown): value is number | null {
  return value === null || isSafeNonNegativeNumber(value)
}

function isSharedResultPayload(value: unknown): value is SharedResultPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const candidate: Record<string, unknown> = value as Record<string, unknown>

  return (
    candidate.version === SHARED_RESULT_VERSION &&
    typeof candidate.playerName === 'string' &&
    candidate.playerName.length <= MAX_PLAYER_NAME_LENGTH &&
    typeof candidate.resultCount === 'number' &&
    Number.isSafeInteger(candidate.resultCount) &&
    candidate.resultCount > 0 &&
    candidate.resultCount <= 1000 &&
    isSafeNonNegativeNumber(candidate.totalMs) &&
    isSafeNonNegativeNumber(candidate.averageMs) &&
    isNullableNonNegativeNumber(candidate.bestMs) &&
    isNullableNonNegativeNumber(candidate.carryAverageMs) &&
    isNullableNonNegativeNumber(candidate.noCarryAverageMs) &&
    (candidate.carryMinusNoCarryMs === null || isSafeNumber(candidate.carryMinusNoCarryMs))
  )
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

export function encodeSharedResult(payload: SharedResultPayload): string {
  const json = JSON.stringify(payload)
  const base64 = bytesToBase64(new TextEncoder().encode(json))

  return base64.replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')
}

export function decodeSharedResult(encoded: string): SharedResultPayload | null {
  if (
    encoded.length === 0 ||
    encoded.length > MAX_ENCODED_LENGTH ||
    !/^[A-Za-z0-9_-]+$/u.test(encoded) ||
    encoded.length % 4 === 1
  ) {
    return null
  }

  try {
    const base64 = encoded.replace(/-/gu, '+').replace(/_/gu, '/')
    const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(paddedBase64))
    const parsed: unknown = JSON.parse(json)

    return isSharedResultPayload(parsed) ? parsed : null
  } catch {
    return null
  }
}
