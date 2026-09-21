<script setup lang="ts">
import { computed, ref } from 'vue'
import { mdiHome, mdiRefresh, mdiShareVariant } from '@mdi/js'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'

import { createSharedResultPayload, reconstructSharedResults } from '../domain/sharing/sharedResult'
import {
  decodeSharedResult,
  encodeSharedResult,
  MAX_PLAYER_NAME_BYTES,
  MAX_PLAYER_NAME_LENGTH,
} from '../domain/sharing/sharedResultCodec'
import { shareResultUrl } from '../domain/sharing/shareResultUrl'
import {
  analyzeTrainingResults,
  formatElapsedTime,
  shouldShowCarryTrend,
} from '../domain/training/resultAnalyzer'
import { useTrainingStore } from '../stores/training'

const route = useRoute()
const router = useRouter()
const trainingStore = useTrainingStore()
const { results } = storeToRefs(trainingStore)
const playerName = ref('')
const isSharing = ref(false)
const shareDialog = ref(false)
const notification = ref('')
const appIconUrl = `${import.meta.env.BASE_URL}pwa-192x192.png`

const shareParameter = computed(() => route.query.s)
const hasShareParameter = computed(() => shareParameter.value !== undefined)
const sharedPayload = computed(() => {
  const parameter = shareParameter.value
  return typeof parameter === 'string' ? decodeSharedResult(parameter) : null
})
const sharedResults = computed(() =>
  sharedPayload.value ? reconstructSharedResults(sharedPayload.value) : null,
)
const isSharedResult = computed(() => sharedResults.value !== null)
const displayResults = computed(() => sharedResults.value ?? results.value)
const hasDisplayResult = computed(() => displayResults.value.length > 0)
const canShare = computed(
  () => hasDisplayResult.value && !isSharedResult.value && !hasShareParameter.value,
)
const analysis = computed(() => analyzeTrainingResults(displayResults.value))
const typicalTimeMs = computed(() => analysis.value.medianMs)
const showCarryTrend = computed(() => shouldShowCarryTrend(analysis.value.carryComparison))
const orderedResults = computed(() =>
  [...displayResults.value].sort((left, right) => left.questionIndex - right.questionIndex),
)
const maxElapsedMs = computed(() =>
  orderedResults.value.reduce((maximum, result) => Math.max(maximum, result.elapsedMs), 0),
)

const sharedResultHeading = computed(() => {
  const name = sharedPayload.value?.playerName.trim()
  return name ? `${name}さんの結果` : '共有された結果'
})
const isPlayerNameValid = computed(
  () => new TextEncoder().encode(playerName.value).length <= MAX_PLAYER_NAME_BYTES,
)

function validatePlayerName(value: string): true | string {
  return new TextEncoder().encode(value).length <= MAX_PLAYER_NAME_BYTES
    ? true
    : `プレイヤー名はUTF-8で${MAX_PLAYER_NAME_BYTES} bytes以内にしてください`
}

function detailBarWidth(elapsedMs: number): number {
  if (maxElapsedMs.value <= 0) {
    return 0
  }

  return Math.min(100, Math.max(0, (elapsedMs / maxElapsedMs.value) * 100))
}

function createShareUrl(): string | null {
  const payload = createSharedResultPayload(results.value, playerName.value)

  if (!payload || !isPlayerNameValid.value) {
    return null
  }

  try {
    const resolved = router.resolve({
      name: 'result',
      query: { s: encodeSharedResult(payload) },
    })

    return new URL(resolved.href, window.location.href).href
  } catch {
    return null
  }
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
        <header class="result-header">
          <div class="result-brand">
            <img
              class="result-app-icon"
              :src="appIconUrl"
              alt=""
              aria-hidden="true"
              data-testid="app-icon"
            />
            <h1 class="result-title font-weight-bold">トレーニング結果</h1>
          </div>

          <v-dialog
            v-if="canShare"
            v-model="shareDialog"
            max-width="440"
            aria-labelledby="share-heading"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                class="share-activator"
                :icon="mdiShareVariant"
                variant="text"
                color="secondary"
                aria-label="成績を共有"
                data-testid="open-share-button"
              />
            </template>
            <v-card class="share-dialog" rounded="xl">
              <v-card-title><h2 id="share-heading" class="text-h6">成績を共有</h2></v-card-title>
              <v-card-text>
                <v-text-field
                  v-model="playerName"
                  label="プレイヤー名"
                  :maxlength="MAX_PLAYER_NAME_LENGTH"
                  :rules="[validatePlayerName]"
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
                  :disabled="!isPlayerNameValid"
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
              <v-card-actions>
                <v-btn min-height="44" @click="shareDialog = false">閉じる</v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </header>

        <template v-if="hasShareParameter && !isSharedResult">
          <v-alert type="warning" variant="tonal" rounded="lg" data-testid="share-error">
            この共有データは読み込めません。URLが正しいか確認してください。
          </v-alert>
          <div class="result-actions">
            <v-btn block color="primary" size="large" :prepend-icon="mdiHome" to="/">
              ホームへ戻る
            </v-btn>
          </div>
        </template>

        <template v-else-if="hasDisplayResult">
          <p
            v-if="isSharedResult"
            class="shared-result-heading text-center text-medium-emphasis"
            data-testid="shared-result-heading"
          >
            {{ sharedResultHeading }}
          </p>

          <section aria-labelledby="summary-heading">
            <h2 id="summary-heading" class="visually-hidden">基本成績</h2>
            <dl class="summary-metrics">
              <div class="total-metric" data-testid="primary-metric">
                <dt>合計タイム</dt>
                <dd data-testid="total-time">{{ formatElapsedTime(analysis.totalMs) }}</dd>
              </div>
              <div class="supporting-metrics">
                <div class="supporting-metric">
                  <dt aria-label="いつもの速さ（回答時間の中央値）">いつもの速さ</dt>
                  <dd data-testid="typical-time">{{ formatElapsedTime(typicalTimeMs) }}</dd>
                </div>
                <div class="supporting-metric">
                  <dt>ベスト</dt>
                  <dd data-testid="best-time">{{ formatElapsedTime(analysis.bestMs) }}</dd>
                </div>
              </div>
            </dl>
          </section>

          <section
            v-if="showCarryTrend"
            class="carry-trend"
            aria-labelledby="carry-trend-heading"
            data-testid="carry-trend"
          >
            <h2 id="carry-trend-heading">今回の傾向</h2>
            <p class="mb-0" data-testid="carry-difference">
              繰り上がりありの問題は
              {{ formatElapsedTime(analysis.carryComparison.carryMinusNoCarryMs) }} 遅めでした
            </p>
          </section>

          <div class="result-actions">
            <v-btn
              block
              color="primary"
              size="large"
              :prepend-icon="mdiRefresh"
              @click="restartTraining"
            >
              もう一度挑戦する
            </v-btn>
          </div>

          <v-expansion-panels
            v-if="orderedResults.length > 0"
            class="details-panels"
            variant="accordion"
          >
            <v-expansion-panel elevation="0" rounded="lg">
              <v-expansion-panel-title data-testid="details-toggle">
                詳細結果
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <ol class="detail-list" aria-label="問題ごとの詳細結果">
                  <li
                    v-for="result in orderedResults"
                    :key="result.questionIndex"
                    class="detail-row"
                    data-testid="detail-row"
                  >
                    <span
                      class="detail-bar"
                      :style="{ width: `${detailBarWidth(result.elapsedMs)}%` }"
                      :data-bar-width="detailBarWidth(result.elapsedMs)"
                      data-testid="detail-bar"
                      aria-hidden="true"
                    />
                    <span class="detail-number" aria-hidden="true">{{ result.questionIndex }}</span>
                    <span class="visually-hidden">問題{{ result.questionIndex }}、</span>
                    <span
                      class="detail-expression"
                      :aria-label="`${result.leftOperand}たす${result.rightOperand}`"
                    >
                      {{ result.leftOperand }} + {{ result.rightOperand }}
                    </span>
                    <span class="detail-time">{{ formatElapsedTime(result.elapsedMs) }}</span>
                  </li>
                </ol>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </template>

        <template v-else>
          <v-card class="pa-5 text-center" color="primary-lighten-5" variant="tonal" rounded="lg">
            <p class="text-h6 font-weight-bold mb-2">まだ結果がありません</p>
            <p class="text-body-2 text-medium-emphasis mb-0">
              ホームからトレーニングを開始してください。
            </p>
          </v-card>
          <div class="result-actions">
            <v-btn block color="primary" size="large" :prepend-icon="mdiHome" to="/">
              ホームへ戻る
            </v-btn>
          </div>
        </template>
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
  padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
    max(16px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
}

.result-card {
  padding: clamp(14px, 4vw, 22px);
}

.result-header {
  display: flex;
  min-width: 0;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.result-brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.result-app-icon {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: 7px;
}

.result-title {
  min-width: 0;
  margin: 0;
  font-size: clamp(1.15rem, 5.5vw, 1.45rem);
  line-height: 1.2;
  white-space: nowrap;
}

.share-activator {
  min-width: 44px;
  min-height: 44px;
  flex: 0 0 auto;
}

.shared-result-heading {
  margin: 2px 0 0;
  font-size: 0.9375rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.summary-metrics {
  margin: 0;
}

.total-metric {
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 7px 0 10px;
}

.total-metric dt {
  order: 2;
  color: rgb(var(--v-theme-on-surface), 0.68);
  font-size: 0.9375rem;
  font-weight: 600;
}

.total-metric dd {
  order: 1;
  margin: 0;
  color: rgb(var(--v-theme-primary));
  font-size: clamp(2.75rem, 14vw, 4rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.04em;
  line-height: 1.05;
}

.supporting-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding: 10px 0;
  border: 1px solid rgb(var(--v-theme-primary), 0.18);
  border-radius: 14px;
  background: rgb(var(--v-theme-primary), 0.055);
}

.supporting-metric {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-direction: column;
  padding: 0 8px;
}

.supporting-metric + .supporting-metric {
  border-left: 1px solid rgb(var(--v-theme-primary), 0.18);
}

.supporting-metric dt {
  order: 2;
  color: rgb(var(--v-theme-on-surface), 0.7);
  font-size: 0.875rem;
}

.supporting-metric dd {
  order: 1;
  margin: 0;
  font-size: clamp(1.3rem, 6vw, 1.65rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.carry-trend {
  margin-top: 10px;
  padding: 9px 12px;
  border-radius: 12px;
  background: rgb(var(--v-theme-secondary), 0.1);
}

.carry-trend h2 {
  margin: 0 0 1px;
  color: rgb(var(--v-theme-secondary));
  font-size: 0.875rem;
  font-weight: 700;
}

.carry-trend p {
  font-size: 0.9375rem;
  line-height: 1.4;
}

.result-actions {
  margin-top: 12px;
}

.details-panels {
  margin-top: 10px;
  border: 1px solid rgb(var(--v-theme-primary), 0.18);
  border-radius: 12px;
  overflow: hidden;
}

.details-panels :deep(.v-expansion-panel-title) {
  min-height: 46px;
  padding: 8px 14px;
  font-weight: 700;
}

.details-panels :deep(.v-expansion-panel-text__wrapper) {
  padding: 0 10px 10px;
}

.detail-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.detail-row {
  position: relative;
  display: grid;
  min-height: 38px;
  align-items: center;
  grid-template-columns: 2rem minmax(0, 1fr) auto;
  gap: 8px;
  padding: 6px 9px;
  border-radius: 8px;
  overflow: hidden;
  background: rgb(var(--v-theme-surface-variant), 0.28);
}

.detail-bar {
  position: absolute;
  z-index: 0;
  inset: 0 auto 0 0;
  background: rgb(var(--v-theme-primary), 0.13);
  pointer-events: none;
}

.detail-number,
.detail-expression,
.detail-time {
  position: relative;
  z-index: 1;
}

.detail-number {
  color: rgb(var(--v-theme-on-surface), 0.65);
  font-size: 0.8125rem;
  font-weight: 700;
  text-align: center;
}

.detail-expression {
  min-width: 0;
  font-weight: 600;
}

.detail-time {
  font-size: 0.9375rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  white-space: nowrap;
}

.share-dialog {
  padding: 8px;
}

.result-card :deep(.v-btn:focus-visible),
.details-panels :deep(.v-expansion-panel-title:focus-visible) {
  outline: 3px solid rgb(var(--v-theme-primary), 0.6);
  outline-offset: 2px;
}

.visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  border: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0 0 0 0) !important;
  white-space: nowrap !important;
}

@media (max-width: 359px) {
  .result-container {
    padding-right: 8px;
    padding-left: 8px;
  }

  .result-card {
    padding-right: 12px;
    padding-left: 12px;
  }
}
</style>
