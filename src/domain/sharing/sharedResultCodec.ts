import { deriveQuestionMetadata } from '../training/questionGenerator'

export const SHARED_RESULT_VERSION = 1 as const
export const SHARED_RESULT_COUNT = 10
export const MAX_PLAYER_NAME_BYTES = 0xff
export const MAX_PLAYER_NAME_LENGTH = 100
export const MAX_SHARED_ELAPSED_MS = 0xffffff

const HEADER_BYTES = 2
const QUESTION_BYTES = 5
const QUESTIONS_TOTAL_BYTES = SHARED_RESULT_COUNT * QUESTION_BYTES
const MIN_PAYLOAD_BYTES = HEADER_BYTES + QUESTIONS_TOTAL_BYTES
const MAX_PAYLOAD_BYTES = MIN_PAYLOAD_BYTES + MAX_PLAYER_NAME_BYTES
const MAX_ENCODED_LENGTH = Math.ceil((MAX_PAYLOAD_BYTES * 4) / 3)

export interface SharedQuestionResult {
  leftOperand: number
  rightOperand: number
  elapsedMs: number
}

export interface SharedResultPayload {
  version: typeof SHARED_RESULT_VERSION
  playerName: string
  results: SharedQuestionResult[]
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

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')
}

function base64UrlToBytes(encoded: string): Uint8Array | null {
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
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const bytes = base64ToBytes(padded)
    return bytesToBase64Url(bytes) === encoded ? bytes : null
  } catch {
    return null
  }
}

function quantizeElapsedMs(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || elapsedMs > MAX_SHARED_ELAPSED_MS) {
    throw new RangeError(`elapsedMs must be between 1 and ${MAX_SHARED_ELAPSED_MS}`)
  }

  const rounded = Math.round(elapsedMs)
  if (rounded < 1 || rounded > MAX_SHARED_ELAPSED_MS) {
    throw new RangeError(`rounded elapsedMs must be between 1 and ${MAX_SHARED_ELAPSED_MS}`)
  }

  return rounded
}

function validateQuestionResult(result: SharedQuestionResult): number {
  if (!deriveQuestionMetadata(result.leftOperand, result.rightOperand)) {
    throw new RangeError('operands must form a valid training question using values from 1 to 99')
  }

  return quantizeElapsedMs(result.elapsedMs)
}

export function encodeSharedResult(payload: SharedResultPayload): string {
  if (payload.version !== SHARED_RESULT_VERSION) {
    throw new RangeError(`version must be ${SHARED_RESULT_VERSION}`)
  }
  if (payload.results.length !== SHARED_RESULT_COUNT) {
    throw new RangeError(`results must contain exactly ${SHARED_RESULT_COUNT} questions`)
  }

  const nameBytes = new TextEncoder().encode(payload.playerName)
  if (nameBytes.length > MAX_PLAYER_NAME_BYTES) {
    throw new RangeError(`playerName must be at most ${MAX_PLAYER_NAME_BYTES} UTF-8 bytes`)
  }

  const bytes = new Uint8Array(HEADER_BYTES + nameBytes.length + QUESTIONS_TOTAL_BYTES)
  bytes[0] = SHARED_RESULT_VERSION
  bytes[1] = nameBytes.length
  bytes.set(nameBytes, HEADER_BYTES)

  let offset = HEADER_BYTES + nameBytes.length
  for (const result of payload.results) {
    const elapsedMs = validateQuestionResult(result)
    bytes[offset] = result.leftOperand
    bytes[offset + 1] = result.rightOperand
    bytes[offset + 2] = Math.floor(elapsedMs / 0x10000)
    bytes[offset + 3] = Math.floor(elapsedMs / 0x100) & 0xff
    bytes[offset + 4] = elapsedMs & 0xff
    offset += QUESTION_BYTES
  }

  return bytesToBase64Url(bytes)
}

export function decodeSharedResult(encoded: string): SharedResultPayload | null {
  const bytes = base64UrlToBytes(encoded)

  if (!bytes || bytes.length < MIN_PAYLOAD_BYTES || bytes[0] !== SHARED_RESULT_VERSION) {
    return null
  }

  const nameLength = bytes[1]
  if (
    nameLength === undefined ||
    bytes.length !== HEADER_BYTES + nameLength + QUESTIONS_TOTAL_BYTES
  ) {
    return null
  }

  try {
    const playerName = new TextDecoder('utf-8', { fatal: true }).decode(
      bytes.subarray(HEADER_BYTES, HEADER_BYTES + nameLength),
    )
    const results: SharedQuestionResult[] = []
    let offset = HEADER_BYTES + nameLength

    for (let index = 0; index < SHARED_RESULT_COUNT; index += 1) {
      const leftOperand = bytes[offset]
      const rightOperand = bytes[offset + 1]
      const elapsedHigh = bytes[offset + 2]
      const elapsedMiddle = bytes[offset + 3]
      const elapsedLow = bytes[offset + 4]

      if (
        leftOperand === undefined ||
        rightOperand === undefined ||
        elapsedHigh === undefined ||
        elapsedMiddle === undefined ||
        elapsedLow === undefined ||
        !deriveQuestionMetadata(leftOperand, rightOperand)
      ) {
        return null
      }

      const elapsedMs = elapsedHigh * 0x10000 + elapsedMiddle * 0x100 + elapsedLow
      if (elapsedMs < 1 || elapsedMs > MAX_SHARED_ELAPSED_MS) {
        return null
      }

      results.push({ leftOperand, rightOperand, elapsedMs })
      offset += QUESTION_BYTES
    }

    return { version: SHARED_RESULT_VERSION, playerName, results }
  } catch {
    return null
  }
}
