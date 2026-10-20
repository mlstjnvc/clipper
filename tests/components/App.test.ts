import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import App from '@/entrypoints/popup/App.vue'
import type { PreviewResult, SaveResult } from '@/lib/messages'
import { fakeBackground, sentTypes } from '../background'
import { makePreview } from '../factories'

const user = { id: 'u1', name: 'Ana', email: 'ana@example.com' }
const signedIn = { signedIn: true as const, user }

const mountPopup = async () => {
  const wrapper = mount(App)
  await flushPromises()
  return wrapper
}

describe('popup App', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.restoreAllMocks()
    vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([{ id: 7 }] as never)
  })

  describe('signed out', () => {
    it('shows the sign-in form and does not read the page', async () => {
      const background = fakeBackground({ 'auth:status': { signedIn: false } })

      const wrapper = await mountPopup()

      expect(wrapper.find('form').exists()).toBe(true)
      expect(sentTypes(background)).toEqual(['auth:status'])
    })

    it('treats an unreachable background as signed out', async () => {
      fakeBackground({})

      expect((await mountPopup()).find('form').exists()).toBe(true)
    })

    it('previews the page once the user signs in', async () => {
      vi.spyOn(fakeBrowser.permissions, 'request').mockResolvedValue(true as never)
      fakeBackground({
        'auth:status': { signedIn: false },
        'auth:sign-in': { ok: true, user },
        'clip:preview': { status: 'ok', page: makePreview({ title: 'Night trains' }) },
      })
      const wrapper = await mountPopup()

      await wrapper.get('[data-test="email"]').setValue('ana@example.com')
      await wrapper.get('[data-test="password"]').setValue('pw')
      await wrapper.get('form').trigger('submit')
      await flushPromises()

      expect(wrapper.get('[data-test="account"]').text()).toBe('ana@example.com')
      expect(wrapper.text()).toContain('Night trains')
    })
  })

  describe('signed in', () => {
    const withPreview = (preview: PreviewResult | ((p: { tabId: number }) => PreviewResult)) =>
      fakeBackground({ 'auth:status': signedIn, 'clip:preview': preview })

    it('shows the account and previews the active tab', async () => {
      const background = withPreview(({ tabId }) =>
        tabId === 7
          ? { status: 'ok', page: makePreview({ title: 'Night trains', wordCount: 412 }) }
          : { status: 'not-clippable' },
      )

      const text = (await mountPopup()).text()

      expect(sentTypes(background)).toEqual(['auth:status', 'clip:preview'])
      expect(text).toContain('ana@example.com')
      expect(text).toContain('Night trains')
      expect(text).toContain('412 words')
      expect(text).toContain('Article')
    })

    it('shows when a page cannot be clipped', async () => {
      withPreview({ status: 'not-clippable' })

      expect((await mountPopup()).text()).toContain("This page can't be clipped")
    })

    it('treats a missing active tab as not clippable', async () => {
      vi.spyOn(fakeBrowser.tabs, 'query').mockResolvedValue([] as never)
      const background = withPreview({ status: 'ok', page: makePreview() })

      expect((await mountPopup()).text()).toContain("This page can't be clipped")
      expect(sentTypes(background)).toEqual(['auth:status'])
    })

    it('shows a generic error when the preview fails to arrive', async () => {
      fakeBackground({ 'auth:status': signedIn })

      expect((await mountPopup()).text()).toContain('Something went wrong')
    })

    it('retries the preview after an error', async () => {
      let attempt = 0
      withPreview(() =>
        attempt++ === 0
          ? { status: 'error', message: 'No text here.' }
          : { status: 'ok', page: makePreview({ title: 'Night trains' }) },
      )
      const wrapper = await mountPopup()
      expect(wrapper.text()).toContain('No text here.')

      await wrapper.get('[data-test="retry"]').trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('Night trains')
    })

    it('signs out and returns to the sign-in form', async () => {
      const background = fakeBackground({
        'auth:status': signedIn,
        'clip:preview': { status: 'not-clippable' },
        'auth:sign-out': { ok: true },
      })
      const wrapper = await mountPopup()

      await wrapper.get('[data-test="sign-out"]').trigger('click')
      await flushPromises()

      expect(sentTypes(background)).toContain('auth:sign-out')
      expect(wrapper.find('form').exists()).toBe(true)
    })
  })

  describe('saving', () => {
    const page = makePreview({ title: 'Night trains' })

    const mountWithSave = async (save: SaveResult | (() => SaveResult)) => {
      const background = fakeBackground({
        'auth:status': signedIn,
        'clip:preview': { status: 'ok', page },
        'clip:save': save,
      })
      const wrapper = await mountPopup()
      await wrapper.get('[data-test="save"]').trigger('click')
      await flushPromises()
      return { wrapper, background }
    }

    it('saves the previewed tab and confirms it', async () => {
      const { wrapper, background } = await mountWithSave({
        status: 'saved',
        clip: { id: 'c1', createdAt: 'x' },
      })

      expect(background).toHaveBeenCalledWith({ type: 'clip:save', payload: { tabId: 7 } })
      expect(wrapper.text()).toContain('Saved to dlmnt.')
      expect(wrapper.get('[data-test="save"]').text()).toBe('Saved')
    })

    it.each([
      ['too-large', 'This page is too large to save.'],
      ['throttled', 'Too many saves'],
      ['network', "Can't reach dlmnt"],
      ['server', 'had a problem saving'],
    ] as const)('shows a %s error with Retry', async (kind, message) => {
      const { wrapper } = await mountWithSave({
        status: 'failed',
        error: { kind, status: null, message: null },
      })

      expect(wrapper.text()).toContain(message)
      expect(wrapper.find('[data-test="retry"]').exists()).toBe(true)
    })

    it('retries a failed save', async () => {
      let attempt = 0
      const { wrapper, background } = await mountWithSave(() =>
        attempt++ === 0
          ? { status: 'failed', error: { kind: 'network', status: null, message: null } }
          : { status: 'saved', clip: { id: 'c1', createdAt: 'x' } },
      )

      await wrapper.get('[data-test="retry"]').trigger('click')
      await flushPromises()

      expect(sentTypes(background).filter((type) => type === 'clip:save')).toHaveLength(2)
      expect(wrapper.text()).toContain('Saved to dlmnt.')
    })

    it('sends the user back to sign-in when the token is no longer valid', async () => {
      const { wrapper } = await mountWithSave({
        status: 'failed',
        error: { kind: 'unauthorized', status: 401, message: null },
      })

      expect(wrapper.find('form').exists()).toBe(true)
      expect(wrapper.get('[data-test="notice"]').text()).toContain('expired')
    })

    it('shows what changed when the tab can no longer be clipped', async () => {
      const { wrapper } = await mountWithSave({ status: 'not-clippable' })

      expect(wrapper.text()).toContain("This page can't be clipped")
    })

    it('shows a generic error when the background does not answer', async () => {
      fakeBackground({ 'auth:status': signedIn, 'clip:preview': { status: 'ok', page } })
      const wrapper = await mountPopup()

      await wrapper.get('[data-test="save"]').trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('Something went wrong')
    })
  })
})
