<script setup lang="ts">
import { mdiBrain, mdiPlay } from '@mdi/js'
import { useRouter } from 'vue-router'

import { useTrainingStore } from '../stores/training'

const router = useRouter()
const trainingStore = useTrainingStore()

function startTraining() {
  trainingStore.startTraining()
  void router.push('/training')
}
</script>

<template>
  <v-main class="d-flex align-center app-background">
    <v-container class="screen-container">
      <v-card class="home-card text-center" elevation="4" rounded="xl">
        <v-icon class="home-icon" :icon="mdiBrain" color="primary" aria-hidden="true" />
        <h1 class="home-title font-weight-bold mt-3">暗算トレーニング</h1>
        <p class="text-body-1 text-medium-emphasis mt-3 mb-6">
          10問の暗算に挑戦して、計算スピードを鍛えましょう。
        </p>
        <v-btn block color="primary" size="x-large" :prepend-icon="mdiPlay" @click="startTraining">
          トレーニング開始
        </v-btn>
      </v-card>
    </v-container>
  </v-main>
</template>

<style scoped>
.app-background {
  min-height: 100vh;
  min-height: 100svh;
  min-height: 100dvh;
  background: linear-gradient(160deg, #fdf8ff 0%, #f1e8ff 100%);
}

.screen-container {
  width: 100%;
  max-width: 560px;
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
    max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
}

.home-card {
  padding: clamp(24px, 6vw, 40px);
}

.home-icon {
  font-size: clamp(56px, 18vw, 72px);
}

.home-title {
  font-size: clamp(1.75rem, 8vw, 2.5rem);
  line-height: 1.15;
  white-space: nowrap;
}
</style>
