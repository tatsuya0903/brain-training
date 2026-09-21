import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'

import NumberPad from '../components/NumberPad.vue'
import vuetify from '../plugins/vuetify'

let wrapper: VueWrapper | undefined

function mountNumberPad() {
  wrapper = mount(NumberPad, { global: { plugins: [vuetify] } })
  return wrapper
}

afterEach(() => wrapper?.unmount())

describe('NumberPad', () => {
  it('renders calculator-style rows followed by delete, zero, and OK', () => {
    const numberPad = mountNumberPad()

    expect(numberPad.findAll('button').map((button) => button.attributes('aria-label'))).toEqual([
      '7を入力',
      '8を入力',
      '9を入力',
      '4を入力',
      '5を入力',
      '6を入力',
      '1を入力',
      '2を入力',
      '3を入力',
      '1文字削除',
      '0を入力',
      '回答を決定',
    ])
  })

  it('emits each displayed value and keeps the bottom-row actions unchanged', async () => {
    const numberPad = mountNumberPad()

    for (const label of ['7を入力', '1を入力', '0を入力']) {
      await numberPad.get(`[aria-label="${label}"]`).trigger('click')
    }
    await numberPad.get('[aria-label="1文字削除"]').trigger('click')
    await numberPad.get('[aria-label="回答を決定"]').trigger('click')

    expect(numberPad.emitted('digit')).toEqual([['7'], ['1'], ['0']])
    expect(numberPad.emitted('delete')).toEqual([[]])
    expect(numberPad.emitted('submit')).toEqual([[]])
  })
})
