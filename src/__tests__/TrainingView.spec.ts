import { beforeEach, describe, expect, it } from 'vitest'

import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import App from '../App.vue'
import vuetify from '../plugins/vuetify'
import router from '../router'

async function mountTrainingView() {
  await router.push('/training')
  await router.isReady()

  return mount(App, {
    global: {
      plugins: [createPinia(), router, vuetify],
    },
  })
}

function answerText(wrapper: ReturnType<typeof mount>) {
  return wrapper.get('[aria-label="入力中の回答"]').text()
}

describe('TrainingView number pad', () => {
  beforeEach(async () => {
    await router.push('/')
  })

  it('inputs a digit', async () => {
    const wrapper = await mountTrainingView()

    await wrapper.get('[aria-label="5を入力"]').trigger('click')

    expect(answerText(wrapper)).toBe('5')
  })

  it('inputs multiple digits', async () => {
    const wrapper = await mountTrainingView()

    await wrapper.get('[aria-label="5を入力"]').trigger('click')
    await wrapper.get('[aria-label="8を入力"]').trigger('click')
    await wrapper.get('[aria-label="3を入力"]').trigger('click')

    expect(answerText(wrapper)).toBe('583')
  })

  it('deletes only the last digit', async () => {
    const wrapper = await mountTrainingView()

    await wrapper.get('[aria-label="5を入力"]').trigger('click')
    await wrapper.get('[aria-label="8を入力"]').trigger('click')
    await wrapper.get('[aria-label="1文字削除"]').trigger('click')

    expect(answerText(wrapper)).toBe('5')
  })

  it('keeps the answer empty when deleting an empty value', async () => {
    const wrapper = await mountTrainingView()

    await wrapper.get('[aria-label="1文字削除"]').trigger('click')

    expect(answerText(wrapper)).toBe('未入力')
  })

  it('keeps the current question and clears the answer after an incorrect submission', async () => {
    const wrapper = await mountTrainingView()
    const initialProblem = wrapper.get('[data-testid="problem"]').text()

    await wrapper.get('[aria-label="0を入力"]').trigger('click')
    await wrapper.get('[aria-label="回答を決定"]').trigger('click')

    expect(wrapper.get('[data-testid="problem"]').text()).toBe(initialProblem)
    expect(answerText(wrapper)).toBe('未入力')
  })
})
