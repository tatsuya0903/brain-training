<script setup lang="ts">
import { mdiBackspaceOutline } from '@mdi/js'

defineProps<{ disabled?: boolean }>()

const emit = defineEmits<{
  digit: [value: string]
  delete: []
  submit: []
}>()

const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
</script>

<template>
  <div class="number-pad" aria-label="回答テンキー">
    <v-btn
      v-for="digit in digits"
      :key="digit"
      class="number-key"
      :disabled="disabled"
      color="surface"
      elevation="2"
      :aria-label="`${digit}を入力`"
      @click="emit('digit', digit)"
    >
      {{ digit }}
    </v-btn>

    <v-btn
      class="number-key delete-key"
      :disabled="disabled"
      color="error"
      elevation="2"
      variant="tonal"
      aria-label="1文字削除"
      @click="emit('delete')"
    >
      <v-icon :icon="mdiBackspaceOutline" aria-hidden="true" />
    </v-btn>
    <v-btn
      class="number-key"
      :disabled="disabled"
      color="surface"
      elevation="2"
      aria-label="0を入力"
      @click="emit('digit', '0')"
    >
      0
    </v-btn>
    <v-btn
      class="number-key submit-key font-weight-bold"
      :disabled="disabled"
      color="primary"
      elevation="3"
      aria-label="回答を決定"
      @click="emit('submit')"
    >
      OK
    </v-btn>
  </div>
</template>

<style scoped>
.number-pad {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(6px, 1.5dvh, 12px);
  width: 100%;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}

.number-key {
  min-width: 0;
  min-height: clamp(54px, 10dvh, 68px);
  font-size: clamp(1.2rem, 6vw, 1.4rem);
  touch-action: manipulation;
  transition:
    transform 70ms ease,
    filter 70ms ease;
}

.number-key:active {
  transform: scale(0.96);
  filter: brightness(0.9);
}

.number-key:focus-visible {
  outline: 3px solid rgb(var(--v-theme-primary), 0.45);
  outline-offset: 2px;
}

.delete-key {
  border: 1px solid rgb(var(--v-theme-error), 0.35);
}

.submit-key {
  letter-spacing: 0.04em;
}

@media (prefers-reduced-motion: reduce) {
  .number-key {
    transition: none;
  }
  .number-key:active {
    transform: none;
  }
}
</style>
