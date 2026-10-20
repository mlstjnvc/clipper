import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ClipPreview from '@/components/ClipPreview.vue'
import type { ExtractedPage } from '@/types/extracted-page'
import { makePreview } from '../factories'

const mountPreview = (overrides: Partial<ExtractedPage> = {}, saving = false, saved = false) =>
  mount(ClipPreview, { props: { page: makePreview(overrides), saving, saved } })

describe('ClipPreview', () => {
  it('shows title, byline, site, excerpt and word count', () => {
    const text = mountPreview({ wordCount: 1234 }).text()

    expect(text).toContain('Night trains')
    expect(text).toContain('Ana Petrović')
    expect(text).toContain('Example Rail Journal')
    expect(text).toContain('Sleeper services are coming back.')
    expect(text).toContain('1,234 words')
  })

  it.each([
    ['readability', 'Article'],
    ['selection', 'Selection'],
    ['fallback', 'Full page text'],
  ] as const)('labels the %s method as "%s"', (method, label) => {
    expect(mountPreview({ method }).get('[data-test="method"]').text()).toBe(label)
  })

  it('hides byline and excerpt when the page has none', () => {
    const wrapper = mountPreview({ byline: null, excerpt: null })

    expect(wrapper.find('[data-test="byline"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="excerpt"]').exists()).toBe(false)
  })

  it('falls back to the hostname when the site name is unknown', () => {
    expect(mountPreview({ siteName: null }).text()).toContain('example.com')
  })

  it('uses the singular for one word', () => {
    expect(mountPreview({ wordCount: 1 }).text()).toContain('1 word')
    expect(mountPreview({ wordCount: 1 }).text()).not.toContain('1 words')
  })

  it('emits save when the button is clicked', async () => {
    const wrapper = mountPreview()

    await wrapper.get('[data-test="save"]').trigger('click')

    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('disables the button while saving', () => {
    const button = mountPreview({}, true).get('[data-test="save"]')

    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toBe('Saving…')
  })

  it('shows the page as saved and blocks a second save', () => {
    const button = mountPreview({}, false, true).get('[data-test="save"]')

    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toBe('Saved')
  })

  it('exposes the full title on hover when it is clamped', () => {
    const title = 'A'.repeat(300)
    expect(mountPreview({ title }).get('h2').attributes('title')).toBe(title)
  })
})
