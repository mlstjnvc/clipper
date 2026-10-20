import { beforeEach, describe, expect, it } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { clearAuth, getAuth, isExpired, setAuth } from '@/lib/storage'
import type { StoredAuth } from '@/types/api'

const auth = (expiresAt: string): StoredAuth => ({
  token: '1|secret',
  expiresAt,
  user: { id: 'u1', name: 'Ana', email: 'ana@example.com' },
})

const inAnHour = () => new Date(Date.now() + 3_600_000).toISOString()

describe('auth storage', () => {
  beforeEach(() => fakeBrowser.reset())

  it('stores the sign-in in storage.local only', async () => {
    const valid = auth(inAnHour())
    await setAuth(valid)

    expect(await fakeBrowser.storage.local.get('auth')).toEqual({ auth: valid })
    expect(await fakeBrowser.storage.sync.get(null)).toEqual({})
  })

  it('returns the stored sign-in while it is valid', async () => {
    const valid = auth(inAnHour())
    await setAuth(valid)

    expect(await getAuth()).toEqual(valid)
  })

  it('drops an expired sign-in', async () => {
    await setAuth(auth('2020-01-01T00:00:00Z'))

    expect(await getAuth()).toBeNull()
    expect(await fakeBrowser.storage.local.get('auth')).toEqual({})
  })

  it('clears the sign-in', async () => {
    await setAuth(auth(inAnHour()))
    await clearAuth()

    expect(await getAuth()).toBeNull()
  })
})

describe('isExpired', () => {
  const now = Date.parse('2026-10-20T12:00:00Z')

  it.each([
    ['2026-10-20T12:00:01Z', false],
    ['2026-10-20T12:00:00Z', true],
    ['2026-10-19T12:00:00Z', true],
    ['not a date', true],
  ])('%s → %s', (expiresAt, expired) => {
    expect(isExpired(auth(expiresAt), now)).toBe(expired)
  })
})
