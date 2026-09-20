<script setup lang="ts">
import { computed, ref } from 'vue'
import { mdiHome, mdiRefresh, mdiShareVariant } from '@mdi/js'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

import {
  createSharedResultAnalysis,
  createSharedResultPayload,
} from '../domain/sharing/sharedResult'
import {
  decodeSharedResult,
  encodeSharedResult,
  MAX_PLAYER_NAME_LENGTH,
} from '../domain/sharing/sharedResultCodec'
import { shareResultUrl } from '../domain/sharing/shareResultUrl'
import {
  analyzeTrainingResults,
  formatCarryDifference,
  formatElapsedTime,
} from '../domain/training/resultAnalyzer'
import { useTrainingStore } from '../stores/training'

const route = useRoute()
const router = useRouter()
const trainingStore = useTrainingStore()
const { results } = storeToRefs(trainingStore)
const localAnalysis = computed(() => analyzeTrainingResults(results.value))
const playerName = ref('')
const isSharing = ref(false)
const shareDialog = ref(false)
const notification = ref('')

const shareParameter = computed(() => route.query.share)
const hasShareParameter = computed(() => shareParameter.value !== undefined)
const sharedPayload = computed(() => {
  const parameter = shareParameter.value
  return typeof parameter === 'string' ? decodeSharedResult(parameter) : null
})
const isSharedResult = computed(() => sharedPayload.value !== null)
const hasDisplayResult = computed(() => isSharedResult.value || results.value.length > 0)
const analysis = computed(() =>
  sharedPayload.value ? createSharedResultAnalysis(sharedPayload.value) : localAnalysis.value,
)

const sharedResultHeading = computed(() => {
  const name = sharedPayload.value?.playerName.trim()
  return name ? `${name}さんの結果` : '共有された結果'
})

function createShareUrl(): string | null {
  const payload = createSharedResultPayload(localAnalysis.value, playerName.value)

  if (!payload) {
    return null
  }

  const resolved = router.resolve({
    name: 'result',
    query: { share: encodeSharedResult(payload) },
  })

  return new URL(resolved.href, window.location.href).href
}

async function shareResult() {
  const url = createShareUrl()

  if (!url) {
    notification.value = '共有URLを作成できませんでした'
    return
  }

  isSharing.value = true
  const outcome = await shareResultUrl(url, {
    share: navigator.share?.bind(navigator),
    writeClipboard: navigator.clipboard?.writeText.bind(navigator.clipboard),
  })
  isSharing.value = false

  if (outcome === 'shared') {
    notification.value = '成績を共有しました'
  } else if (outcome === 'copied') {
    notification.value = '共有URLをコピーしました'
  } else if (outcome === 'failed') {
    notification.value = '共有できませんでした。もう一度お試しください。'
  }
}

function restartTraining() {
  trainingStore.startTraining()
  void router.push('/training')
}
</script>

<template>
  <v-main class="result-background">
    <v-container class="result-container">
      <v-card class="result-card" elevation="4" rounded="xl">
        <div class="result-heading text-center">
          <h1 class="result-title font-weight-bold">トレーニング結果</h1>
          <p v-if="isSharedResult" class="text-h6 mt-2 mb-0" data-testid="shared-result-heading">
            {{ sharedResultHeading }}
          </p>
        </div>

        <v-alert
          v-if="hasShareParameter && !isSharedResult"
          type="warning"
          variant="tonal"
          rounded="lg"
          data-testid="share-error"
        >
          この共有データは読み込めません。URLが正しいか確認してください。
        </v-alert>

        <template v-else-if="hasDisplayResult">
          <p class="text-body-2 text-center text-medium-emphasis mb-3">
            {{ analysis.resultCount }}問の回答を集計しました
          </p>

          <section aria-labelledby="summary-heading">
            <h2 id="summary-heading" class="text-subtitle-1 font-weight-bold mb-2">基本成績</h2>
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

          <v-divider class="my-3" />

          <section aria-labelledby="carry-heading">
            <h2 id="carry-heading" class="text-subtitle-1 font-weight-bold mb-2">繰り上がり比較</h2>
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
            <p class="difference-message mt-2 mb-0" data-testid="carry-difference">
              {{ formatCarryDifference(analysis.carryComparison) }}
            </p>
          </section>

          <v-divider class="my-3" />

          <section aria-labelledby="insight-heading">
            <h2 id="insight-heading" class="text-subtitle-1 font-weight-bold mb-2">考察</h2>
            <v-alert class="insight-card" color="primary" variant="tonal" rounded="lg">
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

        <div class="result-actions mt-4">
          <v-dialog
            v-if="hasDisplayResult && !isSharedResult && !hasShareParameter"
            v-model="shareDialog"
            max-width="440"
            aria-labelledby="share-heading"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                block
                color="secondary"
                size="large"
                :prepend-icon="mdiShareVariant"
                data-testid="open-share-button"
                >成績を共有</v-btn
              >
            </template>
            <v-card class="share-dialog" rounded="xl">
              <v-card-title><h2 id="share-heading" class="text-h6">成績を共有</h2></v-card-title>
              <v-card-text>
                <v-text-field
                  v-model="playerName"
                  label="プレイヤー名"
                  :maxlength="MAX_PLAYER_NAME_LENGTH"
                  counter
                  autocomplete="name"
                  autofocus
                />
                <p class="text-body-2 text-medium-emphasis mb-3">
                  共有URLは暗号化されておらず、値を変更できます。個人情報は入力しないでください。
                </p>
                <v-btn
                  block
                  color="secondary"
                  data-testid="share-button"
                  size="large"
                  :loading="isSharing"
                  :prepend-icon="mdiShareVariant"
                  @click="shareResult"
                  >共有する</v-btn
                >
                <v-alert
                  v-if="notification"
                  class="mt-3"
                  density="compact"
                  type="info"
                  variant="tonal"
                  role="status"
                  data-testid="share-notification"
                  >{{ notification }}</v-alert
                >
              </v-card-text>
              <v-card-actions
                ><v-btn min-height="44" @click="shareDialog = false">閉じる</v-btn></v-card-actions
              >
            </v-card>
          </v-dialog>
          <v-btn
            v-if="hasDisplayResult"
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
  min-height: 100vh;
  min-height: 100svh;
  min-height: 100dvh;
  background: linear-gradient(160deg, #fdf8ff 0%, #f1e8ff 100%);
}

.result-container {
  width: 100%;
  max-width: 600px;
  padding: max(16px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
    max(20px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
}

.result-card {
  padding: clamp(16px, 4vw, 24px);
}

.result-heading {
  margin-bottom: 8px;
}

.result-actions {
  display: grid;
  gap: 12px;
}

.metric-grid,
.comparison-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin: 0;
  padding: 12px 0;
  border: 1px solid rgb(var(--v-theme-primary), 0.2);
  border-radius: 12px;
  background: rgb(var(--v-theme-primary), 0.06);
}

.metric-card,
.comparison-grid > div {
  padding: 0 6px;
  min-width: 0;
  text-align: center;
}

.metric-grid dt,
.comparison-grid dt {
  color: rgb(var(--v-theme-on-surface), 0.7);
  font-size: 0.875rem;
}

.metric-grid dd,
.comparison-grid dd {
  margin: 4px 0 0;
  font-size: 1.125rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.comparison-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.difference-message {
  padding: 8px 10px;
  border-radius: 10px;
  background: rgb(var(--v-theme-surface-variant), 0.5);
  text-align: center;
  font-weight: 500;
}

.result-title {
  font-size: 1.75rem;
  line-height: 1.3;
}
.metric-card + .metric-card,
.comparison-grid > div + div {
  border-left: 1px solid rgb(var(--v-theme-primary), 0.2);
}
.insight-card {
  font-size: 0.9375rem;
  line-height: 1.5;
  padding: 12px;
}
.result-heading {
  overflow-wrap: anywhere;
}
.share-dialog {
  padding: 8px;
}
.result-actions :deep(.v-btn:focus-visible) {
  outline: 3px solid rgb(var(--v-theme-primary), 0.6);
  outline-offset: 2px;
}
</style>
