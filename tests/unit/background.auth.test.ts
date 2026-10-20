import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { authStatus, signIn, signOut } from '@/lib/background/auth'
import { getAuth, setAuth } from '@/lib/storage'
import { jsonResponse, mockFetch, requestOf } from '../fetch'

const user = { id: 'u1', name: 'Ana', email: 'ana@example.com' }
const stored = () => ({
  token: '1|secret',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  user,
})

describe('background auth', () => {
  beforeEach(() => fakeBrowser.reset())
  afterEach(() => vi.unstubAllGlobals())

  it('reports signed out without a stored sign-in', async () => {
    expect(await authStatus()).toEqual({ signedIn: false })
  })

  it('reports signed in with the stored user', async () => {
    await setAuth(stored())

    expect(await authStatus()).toEqual({ signedIn: true, user })
  })

  it('reports an expired sign-in as signed out', async () => {
    await setAuth({ ...stored(), expiresAt: '2020-01-01T00:00:00Z' })

    expect(await authStatus()).toEqual({ signedIn: false })
  })

  it('stores the token on a successful sign-in', async () => {
    const auth = stored()
    mockFetch(jsonResponse(200, { success: true, data: auth }))

    expect(await signIn({ email: 'ana@example.com', password: 'pw' })).toEqual({ ok: true, user })
    expect(await getAuth()).toEqual(auth)
  })

  it('stores nothing when sign-in fails', async () => {
    mockFetch(jsonResponse(422, { message: 'Invalid.', errors: { email: ['Invalid.'] } }))

    const result = await signIn({ email: 'ana@example.com', password: 'wrong' })

    expect(result).toMatchObject({ ok: false, error: { kind: 'validation' } })
    expect(await getAuth()).toBeNull()
  })

  it('revokes the token on sign-out and clears it', async () => {
    await setAuth(stored())
    const fetch = mockFetch(jsonResponse(200, { success: true }))

    expect(await signOut()).toEqual({ ok: true })
    expect(requestOf(fetch).method).toBe('DELETE')
    expect(await getAuth()).toBeNull()
  })

  it('clears the sign-in even when the server cannot be reached', async () => {
    await setAuth(stored())
    mockFetch(new TypeError('Failed to fetch'))

    await signOut()

    expect(await getAuth()).toBeNull()
  })
})
