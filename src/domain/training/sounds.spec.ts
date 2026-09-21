import { afterEach, describe, expect, it, vi } from 'vitest'

import { createTrainingSoundPlayer } from './sounds'

class AudioParamMock {
  setValueAtTime = vi.fn<(value: number, startTime: number) => void>()
  linearRampToValueAtTime = vi.fn<(value: number, endTime: number) => void>()
  exponentialRampToValueAtTime = vi.fn<(value: number, endTime: number) => void>()
}

class OscillatorNodeMock {
  frequency = new AudioParamMock()
  type: OscillatorType = 'sine'
  onended: (() => void) | null = null
  connect = vi.fn<(destination: unknown) => void>()
  disconnect = vi.fn<() => void>()
  start = vi.fn<(when?: number) => void>()
  stop = vi.fn<(when?: number) => void>()
}

class GainNodeMock {
  gain = new AudioParamMock()
  connect = vi.fn<(destination: unknown) => void>()
  disconnect = vi.fn<() => void>()
}

class AudioContextMock {
  static instances: AudioContextMock[] = []

  currentTime = 10
  destination = {}
  state: AudioContextState = 'running'
  oscillators: OscillatorNodeMock[] = []
  gains: GainNodeMock[] = []
  resume = vi.fn<() => Promise<void>>(async () => {
    this.state = 'running'
  })
  createOscillator = vi.fn<() => OscillatorNodeMock>(() => {
    const oscillator = new OscillatorNodeMock()
    this.oscillators.push(oscillator)
    return oscillator
  })
  createGain = vi.fn<() => GainNodeMock>(() => {
    const gain = new GainNodeMock()
    this.gains.push(gain)
    return gain
  })

  constructor() {
    AudioContextMock.instances.push(this)
  }
}

function installAudioContextMock() {
  AudioContextMock.instances = []
  vi.stubGlobal('AudioContext', AudioContextMock as unknown as typeof AudioContext)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('training sounds', () => {
  it('provides five distinct sound APIs and reuses one lazy AudioContext', () => {
    installAudioContextMock()
    const sounds = createTrainingSoundPlayer(() => true)

    expect(AudioContextMock.instances).toHaveLength(0)
    sounds.playDigitSound()
    sounds.playDeleteSound()
    sounds.playSubmitSound()
    sounds.playCorrectSound()
    sounds.playIncorrectSound()

    expect(AudioContextMock.instances).toHaveLength(1)
    const context = AudioContextMock.instances[0]!
    expect(context.oscillators.map((oscillator) => oscillator.type)).toEqual([
      'sine',
      'triangle',
      'sine',
      'sine',
      'sine',
      'square',
      'square',
    ])
    expect(
      context.oscillators.map(
        (oscillator) => oscillator.frequency.setValueAtTime.mock.calls[0]?.[0],
      ),
    ).toEqual([880, 300, 520, 660, 880, 220, 175])
    expect(
      context.gains.map((gain) => gain.gain.linearRampToValueAtTime.mock.calls[0]?.[0]),
    ).toEqual([0.025, 0.035, 0.04, 0.06, 0.07, 0.055, 0.06])
  })

  it('does not initialize AudioContext while sound is disabled', () => {
    installAudioContextMock()
    const sounds = createTrainingSoundPlayer(() => false)

    sounds.playDigitSound()
    sounds.playDeleteSound()
    sounds.playSubmitSound()
    sounds.playCorrectSound()
    sounds.playIncorrectSound()

    expect(AudioContextMock.instances).toHaveLength(0)
  })

  it('stays safe when AudioContext is unsupported or construction fails', () => {
    vi.stubGlobal('AudioContext', undefined)
    expect(() => createTrainingSoundPlayer(() => true).playDigitSound()).not.toThrow()

    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('blocked')
        }
      },
    )
    expect(() => createTrainingSoundPlayer(() => true).playCorrectSound()).not.toThrow()
  })

  it('resumes a suspended context before scheduling without making callers wait', async () => {
    installAudioContextMock()
    const sounds = createTrainingSoundPlayer(() => true)
    sounds.playDigitSound()
    const context = AudioContextMock.instances[0]!
    context.oscillators = []
    context.state = 'suspended'

    sounds.playDeleteSound()
    expect(context.resume).toHaveBeenCalledOnce()
    expect(context.oscillators).toHaveLength(0)

    await vi.waitFor(() => expect(context.oscillators).toHaveLength(1))
    expect(context.oscillators[0]!.frequency.setValueAtTime).toHaveBeenCalledWith(300, 10)
  })

  it('absorbs resume and node failures', async () => {
    installAudioContextMock()
    const sounds = createTrainingSoundPlayer(() => true)
    sounds.playDigitSound()
    const context = AudioContextMock.instances[0]!
    context.state = 'suspended'
    context.resume.mockRejectedValueOnce(new Error('resume blocked'))

    expect(() => sounds.playSubmitSound()).not.toThrow()
    await Promise.resolve()
    await Promise.resolve()

    context.state = 'running'
    context.createOscillator.mockImplementationOnce(() => {
      throw new Error('node blocked')
    })
    expect(() => sounds.playIncorrectSound()).not.toThrow()
  })

  it('disconnects each short-lived oscillator and gain after playback', () => {
    installAudioContextMock()
    createTrainingSoundPlayer(() => true).playDigitSound()
    const context = AudioContextMock.instances[0]!
    const oscillator = context.oscillators[0]!
    const gain = context.gains[0]!

    oscillator.onended?.()

    expect(oscillator.disconnect).toHaveBeenCalledOnce()
    expect(gain.disconnect).toHaveBeenCalledOnce()
  })
})
