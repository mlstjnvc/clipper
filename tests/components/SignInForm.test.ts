import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import SignInForm from '@/components/SignInForm.vue'
import type { SignInResult } from '@/lib/messages'
import type { ApiError } from '@/types/api'
import { fakeBackground } from '../background'

const user = { id: 'u1', name: 'Ana', email: 'ana@example.com' }

const fillAndSubmit = async (wrapper: ReturnType<typeof mount>) => {
  await wrapper.get('[data-test="email"]').setValue('  ana@example.com ')
  await wrapper.get('[data-test="password"]').setValue('secret')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

const failingWith = (error: Partial<ApiError>): SignInResult => ({
  ok: false,
  error: { kind: 'server', status: 500, message: null, ...error },
})

describe('SignInForm', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.restoreAllMocks()
    vi.spyOn(fakeBrowser.permissions, 'request').mockResolvedValue(true as never)
  })

  it('keeps the button disabled until both fields are filled', async () => {
    const wrapper = mount(SignInForm)
    const button = () => wrapper.get('[data-test="submit"]')

    expect(button().attributes('disabled')).toBeDefined()
    await wrapper.get('[data-test="email"]').setValue('ana@example.com')
    expect(button().attributes('disabled')).toBeDefined()
    await wrapper.get('[data-test="password"]').setValue('secret')
    expect(button().attributes('disabled')).toBeUndefined()
  })

  it('signs in with the trimmed email and emits the user', async () => {
    const background = fakeBackground({ 'auth:sign-in': { ok: true, user } })
    const wrapper = mount(SignInForm)

    await fillAndSubmit(wrapper)

    expect(background).toHaveBeenCalledWith({
      type: 'auth:sign-in',
      payload: { email: 'ana@example.com', password: 'secret' },
    })
    expect(wrapper.emitted('signedIn')).toEqual([[user]])
  })

  it('asks for access to the API before signing in', async () => {
    const order: string[] = []
    vi.spyOn(fakeBrowser.permissions, 'request').mockImplementation((async () => {
      order.push('permission')
      return true
    }) as never)
    fakeBackground({
      'auth:sign-in': () => {
        order.push('sign-in')
        return { ok: true, user }
      },
    })

    await fillAndSubmit(mount(SignInForm))

    expect(order).toEqual(['permission', 'sign-in'])
  })

  it('does not sign in when access is refused', async () => {
    vi.spyOn(fakeBrowser.permissions, 'request').mockResolvedValue(false as never)
    const background = fakeBackground({ 'auth:sign-in': { ok: true, user } })
    const wrapper = mount(SignInForm)

    await fillAndSubmit(wrapper)

    expect(background).not.toHaveBeenCalled()
    expect(wrapper.get('[data-test="error"]').text()).toContain('needs access to dlmnt')
  })

  const errorCases: [Partial<ApiError>, string][] = [
    [
      { kind: 'validation', status: 422, fields: { email: ['These credentials do not match.'] } },
      'These credentials do not match.',
    ],
    [{ kind: 'throttled', status: 429 }, 'Too many attempts'],
    [{ kind: 'network', status: null }, "Can't reach dlmnt"],
    [{ kind: 'server', status: 500 }, 'Sign-in is currently unavailable'],
  ]

  it.each(errorCases)('shows the error for %j', async (error, message) => {
    fakeBackground({ 'auth:sign-in': failingWith(error) })
    const wrapper = mount(SignInForm)

    await fillAndSubmit(wrapper)

    expect(wrapper.get('[data-test="error"]').text()).toContain(message)
    expect(wrapper.emitted('signedIn')).toBeUndefined()
  })

  it('shows a notice when one is passed', () => {
    const wrapper = mount(SignInForm, { props: { notice: 'Your sign-in has expired.' } })

    expect(wrapper.get('[data-test="notice"]').text()).toBe('Your sign-in has expired.')
  })

  it('disables the form while signing in', async () => {
    let finish: (result: SignInResult) => void = () => {}
    fakeBackground({
      'auth:sign-in': () => new Promise<never>((resolve) => (finish = resolve as never)),
    })
    const wrapper = mount(SignInForm)

    await fillAndSubmit(wrapper)

    expect(wrapper.get('[data-test="submit"]').text()).toBe('Signing in…')
    expect(wrapper.get('[data-test="email"]').attributes('disabled')).toBeDefined()
    finish({ ok: true, user })
    await flushPromises()
    expect(wrapper.get('[data-test="submit"]').text()).toBe('Sign in')
  })
})
