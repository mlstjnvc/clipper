import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { deviceName, fetchMe, requestToken, revokeToken } from '@/lib/api/auth'
import { createClip } from '@/lib/api/clips'
import { setAuth } from '@/lib/storage'
import { makePage } from '../../factories'
import { jsonResponse, mockFetch, requestOf } from '../../fetch'

const API = import.meta.env.WXT_API_URL

describe('API endpoints', () => {
  beforeEach(async () => {
    fakeBrowser.reset()
    await setAuth({
      token: '1|secret',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { id: 'u1', name: 'Ana', email: 'ana@example.com' },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('requests a token with the device name and no bearer header', async () => {
    const fetch = mockFetch(jsonResponse(200, { success: true, data: {} }))

    await requestToken({ email: 'ana@example.com', password: 'pw' })

    expect(requestOf(fetch)).toMatchObject({
      url: `${API}/extension/token`,
      method: 'POST',
      body: { email: 'ana@example.com', password: 'pw', device_name: deviceName() },
    })
    expect(requestOf(fetch).headers.Authorization).toBeUndefined()
    expect(deviceName()).toMatch(/^dlmnt-clipper\/\w+$/)
  })

  it('revokes the current token', async () => {
    const fetch = mockFetch(jsonResponse(200, { success: true }))

    await revokeToken()

    expect(requestOf(fetch)).toMatchObject({
      url: `${API}/extension/token`,
      method: 'DELETE',
      headers: { Authorization: 'Bearer 1|secret' },
    })
  })

  it('fetches the signed-in user', async () => {
    const fetch = mockFetch(jsonResponse(200, { success: true, data: {} }))

    await fetchMe()

    expect(requestOf(fetch)).toMatchObject({ url: `${API}/me`, method: 'GET' })
  })

  it('posts a clip', async () => {
    const fetch = mockFetch(
      jsonResponse(201, { success: true, data: { id: 'c1', createdAt: 'x' } }),
    )
    const payload = { ...makePage(), clippedAt: '2026-10-20T12:00:00Z' }

    expect(await createClip(payload)).toEqual({ ok: true, data: { id: 'c1', createdAt: 'x' } })
    expect(requestOf(fetch)).toMatchObject({ url: `${API}/clips`, method: 'POST', body: payload })
  })
})
