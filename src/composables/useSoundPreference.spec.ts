import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SOUND_ENABLED_STORAGE_KEY, useSoundPreference } from './useSoundPreference'

describe('sound preference', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('defaults to enabled and persists toggles', () => {
    const preference = useSoundPreference()
    expect(preference.soundEnabled.value).toBe(true)

    preference.toggleSound()
    expect(preference.soundEnabled.value).toBe(false)
    expect(localStorage.getItem(SOUND_ENABLED_STORAGE_KEY)).toBe('false')

    preference.toggleSound()
    expect(preference.soundEnabled.value).toBe(true)
    expect(localStorage.getItem(SOUND_ENABLED_STORAGE_KEY)).toBe('true')
  })

  it('restores a saved disabled preference', () => {
    localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, 'false')
    expect(useSoundPreference().soundEnabled.value).toBe(false)
  })

  it('falls back to enabled when reading storage fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    expect(() => useSoundPreference()).not.toThrow()
    expect(useSoundPreference().soundEnabled.value).toBe(true)
  })

  it('keeps the session preference when writing storage fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const preference = useSoundPreference()

    expect(() => preference.toggleSound()).not.toThrow()
    expect(preference.soundEnabled.value).toBe(false)
  })
})
