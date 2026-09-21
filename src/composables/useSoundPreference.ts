import { ref } from 'vue'

export const SOUND_ENABLED_STORAGE_KEY = 'brain-training:sound-enabled'

function readSoundEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(SOUND_ENABLED_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

export function useSoundPreference() {
  const soundEnabled = ref(readSoundEnabled())

  function toggleSound(): void {
    soundEnabled.value = !soundEnabled.value

    try {
      globalThis.localStorage?.setItem(SOUND_ENABLED_STORAGE_KEY, String(soundEnabled.value))
    } catch {
      // Keep the in-memory preference usable when storage is unavailable.
    }
  }

  return { soundEnabled, toggleSound }
}
