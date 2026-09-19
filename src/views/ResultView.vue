<script setup lang="ts">
import { computed } from 'vue'
import { mdiHome, mdiRefresh } from '@mdi/js'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import {
  analyzeTrainingResults,
  formatCarryDifference,
  formatElapsedTime,
} from '../domain/training/resultAnalyzer'
import { useTrainingStore } from '../stores/training'

const router = useRouter()
const trainingStore = useTrainingStore()
const { results } = storeToRefs(trainingStore)
const analysis = computed(() => analyzeTrainingResults(results.value))

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

        <template v-if="results.length > 0">
          <p class="text-h6 text-center font-weight-bold mb-4">
            {{ analysis.resultCount }}問の回答を集計しました
          </p>

          <section aria-labelledby="summary-heading">
            <h2 id="summary-heading" class="text-subtitle-1 font-weight-bold mb-3">基本成績</h2>
            <dl class="metric-grid">
              <div class="metric-card">
                <dt>合計回答時間</dt>
                <dd data-testid="total-time">{{ formatElapsedTime(analysis.totalMs) }}</dd>
              </div>
              <div class="metric-card">
                <dt>平均回答時間</dt>
                <dd data-testid="average-time">{{ formatElapsedTime(analysis.averageMs) }}</dd>
              </div>
              <div class="metric-card">
                <dt>最短回答時間</dt>
                <dd data-testid="best-time">{{ formatElapsedTime(analysis.bestMs) }}</dd>
              </div>
            </dl>
          </section>

          <v-divider class="my-6" />

          <section aria-labelledby="carry-heading">
            <h2 id="carry-heading" class="text-subtitle-1 font-weight-bold mb-3">繰り上がり比較</h2>
            <dl class="comparison-grid">
              <div>
                <dt>繰り上がりなし平均</dt>
                <dd data-testid="no-carry-average">
                  {{ formatElapsedTime(analysis.carryComparison.noCarryAverageMs) }}
                </dd>
              </div>
              <div>
                <dt>繰り上がりあり平均</dt>
                <dd data-testid="carry-average">
                  {{ formatElapsedTime(analysis.carryComparison.carryAverageMs) }}
                </dd>
              </div>
            </dl>
            <p class="difference-message mt-4 mb-0" data-testid="carry-difference">
              {{ formatCarryDifference(analysis.carryComparison) }}
            </p>
          </section>

          <v-divider class="my-6" />

          <section aria-labelledby="insight-heading">
            <h2 id="insight-heading" class="text-subtitle-1 font-weight-bold mb-3">考察</h2>
            <v-alert color="primary" variant="tonal" rounded="lg">
              <p
                v-for="insight in analysis.insights"
                :key="insight.type"
                class="mb-0"
                data-testid="insight"
              >
                {{ insight.text }}
              </p>
            </v-alert>
          </section>
        </template>

        <template v-else>
          <v-card class="pa-5 text-center" color="primary-lighten-5" variant="tonal" rounded="lg">
            <p class="text-h6 font-weight-bold mb-2">まだ結果がありません</p>
            <p class="text-body-2 text-medium-emphasis mb-0">
              ホームからトレーニングを開始してください。
            </p>
          </v-card>
        </template>

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

.metric-grid,
.comparison-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.metric-card,
.comparison-grid > div {
  padding: 16px 10px;
  border: 1px solid rgb(var(--v-theme-primary), 0.2);
  border-radius: 12px;
  background: rgb(var(--v-theme-primary), 0.06);
  text-align: center;
}

.metric-grid dt,
.comparison-grid dt {
  color: rgb(var(--v-theme-on-surface), 0.7);
  font-size: 0.75rem;
}

.metric-grid dd,
.comparison-grid dd {
  margin: 4px 0 0;
  font-size: 1.125rem;
  font-weight: 700;
}

.comparison-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.difference-message {
  padding: 12px 16px;
  border-radius: 10px;
  background: rgb(var(--v-theme-surface-variant), 0.5);
  text-align: center;
  font-weight: 500;
}

@media (max-width: 479px) {
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .comparison-grid {
    grid-template-columns: 1fr;
  }
}
</style>
