import { describe, it, expect } from 'vitest'

import { useSupported } from '@vueuse/core'
import { mount } from '@vue/test-utils'
import App from '../App.vue'
import vuetify from '../plugins/vuetify'
import router from '../router'

describe('App', () => {
  it('renders the setup confirmation with Vuetify', async () => {
    await router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [router, vuetify],
      },
    })

    expect(wrapper.get('h1').text()).toBe('Hello, Brain Training!')
    expect(wrapper.find('.v-icon').exists()).toBe(true)
  })

  it('can use VueUse composables', () => {
    expect(useSupported(() => true).value).toBe(true)
  })
})
