<script setup lang="ts">
import { mdiHome, mdiRefresh } from '@mdi/js'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import { useTrainingStore } from '../stores/training'

const router = useRouter()
const trainingStore = useTrainingStore()
const { results } = storeToRefs(trainingStore)

function restartTraining() {
  trainingStore.startTraining()
  void router.push('/training')
}
</script>

<template>
  <v-main class="result-background">
    <v-container class="result-container py-6 py-sm-10">
      <v-card class="pa-5 pa-sm-8" elevation="4" rounded="xl">
        <div class="text-center mb-6">
          <p class="text-overline text-primary mb-1">Training Complete</p>
          <h1 class="text-h4 font-weight-bold">トレーニング結果</h1>
        </div>

        <v-card class="pa-5 text-center" color="primary-lighten-5" variant="tonal" rounded="lg">
          <template v-if="results.length > 0">
            <p class="text-h5 font-weight-bold mb-2">{{ results.length }}問の回答を記録しました</p>
            <p class="text-body-2 text-medium-emphasis mb-0">
              回答時間と問題情報の詳しい集計は、次の実装で表示します。
            </p>
          </template>
          <template v-else>
            <p class="text-h6 font-weight-bold mb-2">まだ結果がありません</p>
            <p class="text-body-2 text-medium-emphasis mb-0">
              ホームからトレーニングを開始してください。
            </p>
          </template>
        </v-card>

        <div class="result-actions mt-6">
          <v-btn
            v-if="results.length > 0"
            block
            color="primary"
            size="large"
            :prepend-icon="mdiRefresh"
            @click="restartTraining"
          >
            もう一度挑戦する
          </v-btn>
          <v-btn v-else block color="primary" size="large" :prepend-icon="mdiHome" to="/">
            ホームへ戻る
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

.result-actions {
  display: grid;
  gap: 12px;
}
</style>
