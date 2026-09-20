const HAPTIC_PATTERNS = {
  digit: 10,
  delete: 10,
  correct: 30,
  incorrect: [15, 40, 15],
}

export function triggerHaptic(kind: keyof typeof HAPTIC_PATTERNS): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return

  try {
    navigator.vibrate(HAPTIC_PATTERNS[kind])
  } catch {
    // Haptics are optional, including when a browser exposes but disallows the API.
  }
}
