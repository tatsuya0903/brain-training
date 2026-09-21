type SoundKind = 'digit' | 'delete' | 'submit' | 'correct' | 'incorrect'

type Tone = {
  frequency: number
  duration: number
  gain: number
  offset?: number
  type: OscillatorType
}

const SOUND_PATTERNS: Record<SoundKind, readonly Tone[]> = {
  digit: [{ frequency: 880, duration: 0.04, gain: 0.025, type: 'sine' }],
  delete: [{ frequency: 300, duration: 0.045, gain: 0.035, type: 'triangle' }],
  submit: [{ frequency: 520, duration: 0.025, gain: 0.04, type: 'sine' }],
  correct: [
    { frequency: 660, duration: 0.055, gain: 0.06, offset: 0.03, type: 'sine' },
    { frequency: 880, duration: 0.075, gain: 0.07, offset: 0.085, type: 'sine' },
  ],
  incorrect: [
    { frequency: 220, duration: 0.055, gain: 0.055, offset: 0.03, type: 'square' },
    { frequency: 175, duration: 0.07, gain: 0.06, offset: 0.095, type: 'square' },
  ],
}

export type TrainingSoundPlayer = {
  playDigitSound: () => void
  playDeleteSound: () => void
  playSubmitSound: () => void
  playCorrectSound: () => void
  playIncorrectSound: () => void
}

export function createTrainingSoundPlayer(isEnabled: () => boolean): TrainingSoundPlayer {
  let audioContext: AudioContext | undefined
  let resumePromise: Promise<void> | undefined

  function getAudioContext(): AudioContext | undefined {
    if (audioContext?.state === 'closed') audioContext = undefined
    if (audioContext) return audioContext

    try {
      if (typeof globalThis.AudioContext !== 'function') return undefined
      audioContext = new globalThis.AudioContext()
      return audioContext
    } catch {
      return undefined
    }
  }

  function scheduleTone(context: AudioContext, tone: Tone): void {
    let oscillator: OscillatorNode | undefined
    let gainNode: GainNode | undefined

    try {
      const startsAt = context.currentTime + (tone.offset ?? 0)
      const endsAt = startsAt + tone.duration
      oscillator = context.createOscillator()
      gainNode = context.createGain()
      oscillator.type = tone.type
      oscillator.frequency.setValueAtTime(tone.frequency, startsAt)
      gainNode.gain.setValueAtTime(0.0001, startsAt)
      gainNode.gain.linearRampToValueAtTime(tone.gain, startsAt + 0.004)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endsAt)
      oscillator.connect(gainNode)
      gainNode.connect(context.destination)
      oscillator.onended = () => {
        try {
          oscillator?.disconnect()
          gainNode?.disconnect()
        } catch {
          // Nodes are short-lived and may already have been disconnected by the browser.
        }
      }
      oscillator.start(startsAt)
      oscillator.stop(endsAt)
    } catch {
      try {
        oscillator?.disconnect()
        gainNode?.disconnect()
      } catch {
        // Sound is optional; cleanup failures must not affect training.
      }
    }
  }

  function schedulePattern(context: AudioContext, kind: SoundKind): void {
    if (!isEnabled()) return
    for (const tone of SOUND_PATTERNS[kind]) scheduleTone(context, tone)
  }

  function play(kind: SoundKind): void {
    try {
      if (!isEnabled()) return
      const context = getAudioContext()
      if (!context) return

      if (context.state === 'running') {
        schedulePattern(context, kind)
        return
      }

      if (context.state === 'closed') return

      if (!resumePromise) {
        try {
          resumePromise = Promise.resolve(context.resume())
            .catch(() => undefined)
            .finally(() => {
              resumePromise = undefined
            })
        } catch {
          return
        }
      }

      void resumePromise.then(() => {
        try {
          if (context.state === 'running') schedulePattern(context, kind)
        } catch {
          // A resumed context is still optional feedback and cannot affect the caller.
        }
      })
    } catch {
      // Audio is best-effort feedback and must never interrupt game input or timing.
    }
  }

  return {
    playDigitSound: () => play('digit'),
    playDeleteSound: () => play('delete'),
    playSubmitSound: () => play('submit'),
    playCorrectSound: () => play('correct'),
    playIncorrectSound: () => play('incorrect'),
  }
}
