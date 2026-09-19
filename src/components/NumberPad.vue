<script setup lang="ts">
import { mdiBackspaceOutline } from '@mdi/js'

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
      color="surface"
      elevation="2"
      size="x-large"
      :aria-label="`${digit}を入力`"
      @click="emit('digit', digit)"
    >
      {{ digit }}
    </v-btn>

    <v-btn
      class="number-key"
      color="surface-variant"
      elevation="2"
      size="x-large"
      aria-label="1文字削除"
      @click="emit('delete')"
    >
      <v-icon :icon="mdiBackspaceOutline" aria-hidden="true" />
    </v-btn>
    <v-btn
      class="number-key"
      color="surface"
      elevation="2"
      size="x-large"
      aria-label="0を入力"
      @click="emit('digit', '0')"
    >
      0
    </v-btn>
    <v-btn
      class="number-key font-weight-bold"
      color="primary"
      elevation="2"
      size="x-large"
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
  gap: 10px;
  width: 100%;
}

.number-key {
  min-width: 0;
  min-height: 64px;
  font-size: 1.35rem;
}

@media (min-width: 600px) {
  .number-pad {
    gap: 12px;
  }

  .number-key {
    min-height: 68px;
  }
}
</style>
