<script setup lang="ts">
import { onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { mdiCheckCircleOutline, mdiCloseCircleOutline } from '@mdi/js'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import NumberPad from '../components/NumberPad.vue'
import { triggerHaptic } from '../domain/training/haptics'
import { formatElapsedTime } from '../domain/training/resultAnalyzer'
import { CORRECT_FEEDBACK_MS, useTrainingStore } from '../stores/training'

const router = useRouter()
const trainingStore = useTrainingStore()
const {
  questions,
  currentAnswer,
  currentQuestion,
  currentQuestionNumber,
  currentQuestionIndex,
  questionStartedAt,
  isCompleted,
  totalQuestions,
  feedback,
  correctElapsedMs,
  canAnswer,
} = storeToRefs(trainingStore)
const elapsedMs = ref(0)
let frame: number | undefined
let feedbackTimer: ReturnType<typeof setTimeout> | undefined
let mounted = false

onBeforeMount(() => {
  if (totalQuestions.value === 0 || isCompleted.value) trainingStore.startTraining()
})

function stopUpdates() {
  if (frame !== undefined) cancelAnimationFrame(frame)
  if (feedbackTimer !== undefined) clearTimeout(feedbackTimer)
  frame = undefined
  feedbackTimer = undefined
}

function updateElapsed() {
  if (questionStartedAt.value === null) return
  elapsedMs.value = performance.now() - questionStartedAt.value
  frame = requestAnimationFrame(updateElapsed)
}

function synchronizeQuestion() {
  if (!mounted) return
  stopUpdates()
  if (feedback.value === 'correct') {
    elapsedMs.value = correctElapsedMs.value ?? 0
    const sessionQuestions = questions.value
    feedbackTimer = setTimeout(() => {
      feedbackTimer = undefined
      if (!mounted || questions.value !== sessionQuestions) return
      if (trainingStore.advanceAfterFeedback() === 'completed') void router.push('/result')
    }, CORRECT_FEEDBACK_MS)
  } else if (!isCompleted.value) {
    trainingStore.beginQuestion()
    updateElapsed()
  }
}

// flush: post observes the new problem after Vue has updated its DOM.
watch([questions, currentQuestionIndex, feedback], synchronizeQuestion, { flush: 'post' })
onMounted(() => {
  mounted = true
  window.addEventListener('keydown', handleKeydown)
  synchronizeQuestion()
})
onBeforeUnmount(() => {
  mounted = false
  window.removeEventListener('keydown', handleKeydown)
  stopUpdates()
})

function inputDigit(digit: string, withHaptic = true) {
  if (!canAnswer.value) return
  trainingStore.appendDigit(digit)
  if (withHaptic) triggerHaptic('digit')
}

function deleteDigit(withHaptic = true) {
  if (!canAnswer.value) return
  trainingStore.deleteLastDigit()
  if (withHaptic) triggerHaptic('delete')
}

function submitAnswer(withHaptic = true) {
  const result = trainingStore.submitAnswer()
  if (withHaptic && (result === 'correct' || result === 'incorrect')) triggerHaptic(result)
}

function isTextInputTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !==
      null
  )
}

function handleKeydown(event: KeyboardEvent) {
  if (isTextInputTarget(event.target)) return

  const digit = /^\d$/u.test(event.key) ? event.key : undefined
  const isEnter = event.key === 'Enter'
  const isBackspace = event.key === 'Backspace'

  if (digit === undefined && !isEnter && !isBackspace) return

  event.preventDefault()
  if (event.repeat || !canAnswer.value) return

  if (digit !== undefined) inputDigit(digit, false)
  else if (isEnter) submitAnswer(false)
  else deleteDigit(false)
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
            <p
              class="elapsed-time mb-0"
              aria-label="現在の問題の経過時間"
              data-testid="elapsed-time"
            >
              {{ (elapsedMs / 1000).toFixed(1) }}秒
            </p>
          </div>
          <div
            class="progress-segments"
            role="progressbar"
            aria-label="トレーニング進捗"
            :aria-valuenow="currentQuestionNumber"
            :aria-valuemin="0"
            :aria-valuemax="totalQuestions"
            :aria-valuetext="`${currentQuestionNumber} / ${totalQuestions}`"
          >
            <span
              v-for="position in totalQuestions"
              :key="position"
              class="progress-segment"
              :class="{ active: position <= currentQuestionNumber }"
              aria-hidden="true"
            />
          </div>
        </header>

        <section class="problem-area text-center" aria-labelledby="problem-heading">
          <p id="problem-heading" class="problem-label text-caption text-medium-emphasis">
            暗算問題
          </p>
          <p v-if="currentQuestion" class="problem-text font-weight-bold" data-testid="problem">
            {{ currentQuestion.leftOperand }} + {{ currentQuestion.rightOperand }}
          </p>
          <p class="answer-label text-caption text-medium-emphasis">入力中の回答</p>
          <div
            class="answer-display"
            :class="feedback"
            aria-live="polite"
            aria-label="入力中の回答"
          >
            <span v-if="currentAnswer">{{ currentAnswer }}</span>
            <span v-else class="answer-placeholder">未入力</span>
          </div>
          <div
            class="answer-feedback"
            :class="feedback"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="answer-feedback"
          >
            <template v-if="feedback">
              <v-icon
                :icon="feedback === 'correct' ? mdiCheckCircleOutline : mdiCloseCircleOutline"
                aria-hidden="true"
              />
              <span>{{ feedback === 'correct' ? '正解！' : '不正解' }}</span>
              <strong v-if="feedback === 'correct'" data-testid="correct-time">{{
                formatElapsedTime(correctElapsedMs)
              }}</strong>
            </template>
          </div>
        </section>

        <NumberPad
          :disabled="!canAnswer"
          @digit="inputDigit"
          @delete="deleteDigit"
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
  padding: clamp(6px, 1.5dvh, 16px) 0 0;
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
.progress-segments {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 4px;
}
.progress-segment {
  height: 8px;
  border-radius: 4px;
  border: 1px solid rgb(var(--v-theme-primary), 0.4);
}
.progress-segment.active {
  background: rgb(var(--v-theme-primary));
}
.elapsed-time {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.answer-feedback {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 32px;
  font-size: 1rem;
}
.correct {
  color: rgb(var(--v-theme-success));
}
.incorrect {
  color: rgb(var(--v-theme-error));
}
.answer-display.correct,
.answer-display.incorrect {
  border-color: currentColor;
}
</style>
