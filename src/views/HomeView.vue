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
    <v-container class="screen-container py-8">
      <v-card class="pa-6 pa-sm-10 text-center" elevation="4" rounded="xl">
        <v-icon :icon="mdiBrain" color="primary" size="72" aria-hidden="true" />
        <h1 class="text-h3 font-weight-bold mt-4">暗算トレーニング</h1>
        <p class="text-body-1 text-medium-emphasis mt-4 mb-8">
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
  background: linear-gradient(160deg, #fdf8ff 0%, #f1e8ff 100%);
}

.screen-container {
  width: 100%;
  max-width: 560px;
}
</style>
