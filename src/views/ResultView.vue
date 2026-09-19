<script setup lang="ts">
import { mdiRefresh, mdiShareVariant } from '@mdi/js'

const resultItems = [
  { label: '合計回答時間', value: '18.42秒' },
  { label: '平均回答時間', value: '1.84秒' },
  { label: '最短回答時間', value: '1.12秒' },
  { label: '繰り上がりなし', value: '平均 1.61秒' },
  { label: '繰り上がりあり', value: '平均 2.07秒' },
]
</script>

<template>
  <v-main class="result-background">
    <v-container class="result-container py-6 py-sm-10">
      <v-card class="pa-5 pa-sm-8" elevation="4" rounded="xl">
        <div class="text-center mb-6">
          <p class="text-overline text-primary mb-1">Training Complete</p>
          <h1 class="text-h4 font-weight-bold">トレーニング結果</h1>
        </div>

        <v-list class="result-list pa-0" lines="one">
          <v-list-item v-for="item in resultItems" :key="item.label" class="px-3">
            <template #title>
              <span class="text-body-2 text-medium-emphasis">{{ item.label }}</span>
            </template>
            <template #append>
              <span class="font-weight-bold">{{ item.value }}</span>
            </template>
          </v-list-item>
        </v-list>

        <v-card class="mt-5 pa-4" color="primary-lighten-5" variant="tonal" rounded="lg">
          <h2 class="text-subtitle-1 font-weight-bold mb-2">考察</h2>
          <p class="text-body-2 mb-0">
            繰り上がりのある問題では、少し時間がかかる傾向がありました。
          </p>
        </v-card>

        <div class="result-actions mt-6">
          <v-btn block color="primary" size="large" :prepend-icon="mdiRefresh" to="/training">
            もう一度挑戦する
          </v-btn>
          <v-btn block size="large" :prepend-icon="mdiShareVariant" variant="outlined">
            成績を共有する
          </v-btn>
        </div>
      </v-card>
    </v-container>
  </v-main>
</template>

<style scoped>
.result-background {
  min-height: 100dvh;
  background: linear-gradient(160deg, #fdf8ff 0%, #f1e8ff 100%);
}

.result-container {
  width: 100%;
  max-width: 600px;
}

.result-list {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
}

.result-list :deep(.v-list-item + .v-list-item) {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.result-actions {
  display: grid;
  gap: 12px;
}
</style>
