import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { apiRequest, apiUrl, authorizedRequest } from '@/lib/api/client'
import { getAuth, setAuth } from '@/lib/storage'
import { jsonResponse, mockFetch, requestOf } from '../../fetch'

const API = import.meta.env.WXT_API_URL

describe('apiUrl', () => {
  it('joins the configured base URL and a path', () => {
    expect(apiUrl('clips')).toBe(`${API}/clips`)
    expect(apiUrl('/extension/token')).toBe(`${API}/extension/token`)
  })
})

describe('apiRequest', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends JSON with the bearer token and unwraps data', async () => {
    const fetch = mockFetch(jsonResponse(201, { success: true, data: { id: 'c1' } }))

    const result = await apiRequest('clips', { method: 'POST', body: { a: 1 }, token: 't0k' })

    expect(result).toEqual({ ok: true, data: { id: 'c1' } })
    expect(requestOf(fetch)).toEqual({
      url: `${API}/clips`,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer t0k',
      },
      body: { a: 1 },
    })
  })

  it('sends no body or auth headers when there are none', async () => {
    const fetch = mockFetch(jsonResponse(200, { success: true, data: null }))

    await apiRequest('me')

    expect(requestOf(fetch)).toMatchObject({
      method: 'GET',
      headers: { Accept: 'application/json' },
      body: undefined,
    })
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [413, 'too-large'],
    [422, 'validation'],
    [429, 'throttled'],
    [500, 'server'],
    [404, 'server'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    mockFetch(jsonResponse(status, { message: 'Nope.' }))

    expect(await apiRequest('clips')).toEqual({
      ok: false,
      error: { kind, status, message: 'Nope.' },
    })
  })

  it('keeps validation errors per field', async () => {
    mockFetch(
      jsonResponse(422, {
        message: 'These credentials do not match our records.',
        errors: { email: ['These credentials do not match our records.'] },
      }),
    )

    const result = await apiRequest('extension/token')

    expect(result.ok === false && result.error.fields).toEqual({
      email: ['These credentials do not match our records.'],
    })
  })

  it('reports a network failure without throwing', async () => {
    mockFetch(new TypeError('Failed to fetch'))

    expect(await apiRequest('me')).toEqual({
      ok: false,
      error: { kind: 'network', status: null, message: null },
    })
  })

  it('copes with a response that is not JSON', async () => {
    mockFetch(new Response('<html>Bad gateway</html>', { status: 502 }))

    expect(await apiRequest('me')).toEqual({
      ok: false,
      error: { kind: 'server', status: 502, message: null },
    })
  })
})

describe('authorizedRequest', () => {
  const user = { id: 'u1', name: 'Ana', email: 'ana@example.com' }
  const signIn = (expiresAt = new Date(Date.now() + 3_600_000).toISOString()) =>
    setAuth({ token: '1|secret', expiresAt, user })

  beforeEach(() => fakeBrowser.reset())
  afterEach(() => vi.unstubAllGlobals())

  it('uses the stored token', async () => {
    await signIn()
    const fetch = mockFetch(jsonResponse(200, { success: true, data: user }))

    expect(await authorizedRequest('me')).toEqual({ ok: true, data: user })
    expect(requestOf(fetch).headers.Authorization).toBe('Bearer 1|secret')
  })

  it('sends nothing when signed out', async () => {
    const fetch = mockFetch()

    expect(await authorizedRequest('me')).toMatchObject({
      ok: false,
      error: { kind: 'unauthorized' },
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('never sends an expired token', async () => {
    await signIn('2020-01-01T00:00:00Z')
    const fetch = mockFetch()

    expect(await authorizedRequest('me')).toMatchObject({ error: { kind: 'unauthorized' } })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('drops the stored sign-in when the server says 401', async () => {
    await signIn()
    mockFetch(jsonResponse(401, { message: 'Unauthenticated.' }))

    expect(await authorizedRequest('me')).toMatchObject({ error: { kind: 'unauthorized' } })
    expect(await getAuth()).toBeNull()
  })

  it('keeps the sign-in on other errors', async () => {
    await signIn()
    mockFetch(jsonResponse(429, {}))

    await authorizedRequest('clips')

    expect(await getAuth()).not.toBeNull()
  })
})
