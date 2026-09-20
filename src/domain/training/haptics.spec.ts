import { afterEach, describe, expect, it, vi } from 'vitest'
import { triggerHaptic } from './haptics'

describe('optional haptics', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('uses short, distinct patterns and preserves the navigator receiver', () => {
    const vibrate = vi.fn<(pattern: VibratePattern) => boolean>().mockReturnValue(true)
    const navigatorMock = { vibrate }
    vi.stubGlobal('navigator', navigatorMock)
    triggerHaptic('digit')
    triggerHaptic('delete')
    triggerHaptic('correct')
    triggerHaptic('incorrect')
    expect(vibrate.mock.calls).toEqual([[10], [10], [30], [[15, 40, 15]]])
    expect(vibrate.mock.contexts.every((receiver) => receiver === navigatorMock)).toBe(true)
  })
  it.each([
    undefined,
    {},
    { vibrate: false },
    { vibrate: () => false },
    {
      vibrate: () => {
        throw new Error('Blocked')
      },
    },
  ])('tolerates unavailable vibration: %j', (navigatorMock) => {
    vi.stubGlobal('navigator', navigatorMock)
    expect(() => triggerHaptic('correct')).not.toThrow()
  })
})
