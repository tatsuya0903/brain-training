import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createPinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import App from '../App.vue'
import HomeView from '../views/HomeView.vue'
import vuetify from '../plugins/vuetify'
import { useTrainingStore } from '../stores/training'

const { version: packageVersion } = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as { version: string }

async function mountHomeView() {
  const pinia = createPinia()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: HomeView },
      { path: '/training', component: { template: '<div>Training</div>' } },
    ],
  })
  await router.push('/')
  await router.isReady()

  const wrapper = mount(App, {
    global: {
      plugins: [pinia, router, vuetify],
    },
  })

  return { pinia, router, wrapper }
}

describe('HomeView', () => {
  it('shows the package version with a v prefix without replacing the primary action', async () => {
    const { wrapper } = await mountHomeView()

    expect(wrapper.get('[data-testid="app-version"]').text()).toBe(`v${packageVersion}`)
    expect(wrapper.get('h1').text()).toBe('暗算トレーニング')
    expect(wrapper.get('button').text()).toContain('トレーニング開始')
  })

  it('keeps the existing training start behavior', async () => {
    const { pinia, router, wrapper } = await mountHomeView()

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(useTrainingStore(pinia).questions).toHaveLength(10)
    expect(router.currentRoute.value.path).toBe('/training')
  })
})
