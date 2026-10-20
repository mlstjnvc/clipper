import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ClipStatus from '@/components/ClipStatus.vue'

describe('ClipStatus', () => {
  it('confirms a save', () => {
    const wrapper = mount(ClipStatus, { props: { state: { status: 'saved' } } })

    expect(wrapper.text()).toBe('Saved to dlmnt.')
    expect(wrapper.find('[data-test="retry"]').exists()).toBe(false)
  })

  it('shows the error and emits retry', async () => {
    const wrapper = mount(ClipStatus, {
      props: { state: { status: 'error', message: 'This page is too large to save.' } },
    })

    expect(wrapper.get('[data-test="message"]').text()).toBe('This page is too large to save.')
    await wrapper.get('[data-test="retry"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
