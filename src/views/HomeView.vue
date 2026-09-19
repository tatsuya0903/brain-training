<script setup lang="ts">
import { mdiBrain } from '@mdi/js'
</script>

<template>
  <v-main class="d-flex align-center">
    <v-container class="py-12">
      <v-card class="mx-auto pa-8 text-center" elevation="4" max-width="560" rounded="xl">
        <v-icon :icon="mdiBrain" color="primary" size="64" aria-label="Brain Training" />
        <h1 class="text-h3 font-weight-bold mt-4">Hello, Brain Training!</h1>
        <p class="text-body-1 text-medium-emphasis mt-4 mb-0">
          Vue 3 + TypeScript + Vite + Vuetify is ready.
        </p>
      </v-card>
    </v-container>
  </v-main>
</template>
