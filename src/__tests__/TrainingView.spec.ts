import { beforeEach, describe, expect, it } from 'vitest'

import { mount } from '@vue/test-utils'
import App from '../App.vue'
import vuetify from '../plugins/vuetify'
import router from '../router'

async function mountTrainingView() {
  await router.push('/training')
  await router.isReady()

  return mount(App, {
    global: {
      plugins: [router, vuetify],
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
})
