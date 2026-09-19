<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import NumberPad from '../components/NumberPad.vue'

const router = useRouter()
const answer = ref('')

function appendDigit(digit: string) {
  answer.value += digit
}

function deleteLastDigit() {
  answer.value = answer.value.slice(0, -1)
}

function submitTemporaryResult() {
  // Issue #2では画面遷移のみ。正誤判定やゲーム進行はIssue #3で置き換える。
  void router.push('/result')
}
</script>

<template>
  <v-main class="training-background">
    <v-container class="training-container py-4 py-sm-8">
      <v-card class="pa-4 pa-sm-6" elevation="3" rounded="xl">
        <header>
          <div class="d-flex align-center justify-space-between mb-2">
            <p class="text-subtitle-1 font-weight-bold mb-0">問題 1 / 10</p>
            <p class="text-caption text-medium-emphasis mb-0">全10問</p>
          </div>
          <v-progress-linear
            aria-label="トレーニング進捗"
            color="primary"
            :model-value="10"
            rounded
            height="10"
          />
        </header>

        <section class="problem-area text-center" aria-labelledby="problem-heading">
          <p id="problem-heading" class="text-caption text-medium-emphasis mb-2">暗算問題</p>
          <p class="problem-text font-weight-bold mb-5">47 + 28</p>
          <p class="text-caption text-medium-emphasis mb-1">入力中の回答</p>
          <div class="answer-display" aria-live="polite" aria-label="入力中の回答">
            <span v-if="answer">{{ answer }}</span>
            <span v-else class="answer-placeholder">未入力</span>
          </div>
        </section>

        <NumberPad @digit="appendDigit" @delete="deleteLastDigit" @submit="submitTemporaryResult" />
      </v-card>
    </v-container>
  </v-main>
</template>

<style scoped>
.training-background {
  min-height: 100dvh;
  background: #f7f2fb;
}

.training-container {
  width: 100%;
  max-width: 520px;
}

.problem-area {
  padding: clamp(1.5rem, 6vh, 3.5rem) 0;
}

.problem-text {
  font-size: clamp(2.25rem, 12vw, 3.75rem);
  line-height: 1.1;
  letter-spacing: 0.03em;
}

.answer-display {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 64px;
  overflow-wrap: anywhere;
  border: 2px solid rgb(var(--v-theme-primary));
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  font-size: clamp(1.75rem, 9vw, 2.5rem);
  font-weight: 700;
  line-height: 1.2;
}

.answer-placeholder {
  color: rgb(var(--v-theme-on-surface), 0.38);
  font-size: 1rem;
  font-weight: 400;
}

@media (max-width: 359px) {
  .training-container {
    padding-right: 8px;
    padding-left: 8px;
  }

  .problem-area {
    padding: 1.25rem 0;
  }
}
</style>
