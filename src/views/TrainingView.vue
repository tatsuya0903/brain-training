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
    <v-container class="training-container py-4 py-sm-8">
      <v-card class="pa-4 pa-sm-6" elevation="3" rounded="xl">
        <header>
          <div class="d-flex align-center justify-space-between mb-2">
            <p class="text-subtitle-1 font-weight-bold mb-0">
              問題 {{ currentQuestionNumber }} / {{ totalQuestions }}
            </p>
            <p class="text-caption text-medium-emphasis mb-0">全{{ totalQuestions }}問</p>
          </div>
          <v-progress-linear
            aria-label="トレーニング進捗"
            color="primary"
            :model-value="progress"
            rounded
            height="10"
          />
        </header>

        <section class="problem-area text-center" aria-labelledby="problem-heading">
          <p id="problem-heading" class="text-caption text-medium-emphasis mb-2">暗算問題</p>
          <p
            v-if="currentQuestion"
            class="problem-text font-weight-bold mb-5"
            data-testid="problem"
          >
            {{ currentQuestion.leftOperand }} + {{ currentQuestion.rightOperand }}
          </p>
          <p class="text-caption text-medium-emphasis mb-1">入力中の回答</p>
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
