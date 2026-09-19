<script setup lang="ts">
import { onBeforeMount } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import NumberPad from '../components/NumberPad.vue'
import { useTrainingStore } from '../stores/training'

const router = useRouter()
const trainingStore = useTrainingStore()
const {
  currentAnswer,
  currentQuestion,
  currentQuestionNumber,
  isCompleted,
  progress,
  totalQuestions,
} = storeToRefs(trainingStore)

onBeforeMount(() => {
  if (totalQuestions.value === 0 || isCompleted.value) {
    trainingStore.startTraining()
  }
})

function submitAnswer() {
  const result = trainingStore.submitAnswer()

  if (result === 'completed') {
    void router.push('/result')
  }
}
</script>

<template>
  <v-main class="training-background">
    <v-container class="training-container">
      <v-card class="training-card" elevation="3" rounded="xl">
        <header>
          <div class="progress-heading">
            <p class="question-count font-weight-bold mb-0">
              問題 {{ currentQuestionNumber }} / {{ totalQuestions }}
            </p>
            <p class="text-caption text-medium-emphasis mb-0">全{{ totalQuestions }}問</p>
          </div>
          <v-progress-linear
            aria-label="トレーニング進捗"
            color="primary"
            :model-value="progress"
            rounded
            height="8"
          />
        </header>

        <section class="problem-area text-center" aria-labelledby="problem-heading">
          <p id="problem-heading" class="problem-label text-caption text-medium-emphasis">
            暗算問題
          </p>
          <p v-if="currentQuestion" class="problem-text font-weight-bold" data-testid="problem">
            {{ currentQuestion.leftOperand }} + {{ currentQuestion.rightOperand }}
          </p>
          <p class="answer-label text-caption text-medium-emphasis">入力中の回答</p>
          <div class="answer-display" aria-live="polite" aria-label="入力中の回答">
            <span v-if="currentAnswer">{{ currentAnswer }}</span>
            <span v-else class="answer-placeholder">未入力</span>
          </div>
        </section>

        <NumberPad
          @digit="trainingStore.appendDigit"
          @delete="trainingStore.deleteLastDigit"
          @submit="submitAnswer"
        />
      </v-card>
    </v-container>
  </v-main>
</template>

<style scoped>
.training-background {
  min-height: 100vh;
  min-height: 100svh;
  min-height: 100dvh;
  background: #f7f2fb;
}

.training-container {
  width: 100%;
  max-width: 520px;
  padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right))
    max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
}

.training-card {
  padding: clamp(12px, 2.5dvh, 24px);
}

.progress-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.question-count {
  font-size: clamp(1rem, 4.5vw, 1.125rem);
}

.problem-area {
  padding: clamp(10px, 2.6dvh, 24px) 0;
}

.problem-label,
.answer-label {
  margin: 0 0 4px;
}

.problem-text {
  margin: 0 0 clamp(8px, 2dvh, 18px);
  font-size: clamp(2.25rem, 12vw, 3.75rem);
  line-height: 1.1;
  letter-spacing: 0.03em;
}

.answer-display {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: clamp(50px, 9dvh, 64px);
  padding: 4px 12px;
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
</style>
