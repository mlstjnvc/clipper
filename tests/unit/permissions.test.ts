import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { apiHostPermission } from '@/manifest'
import { ensureApiAccess } from '@/lib/permissions'

describe('ensureApiAccess', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.restoreAllMocks()
  })

  it('requests the API host permission', async () => {
    const request = vi.spyOn(fakeBrowser.permissions, 'request').mockResolvedValue(true as never)

    expect(await ensureApiAccess()).toBe(true)
    expect(request).toHaveBeenCalledWith({
      origins: [apiHostPermission(import.meta.env.WXT_API_URL)],
    })
  })

  it('reports a refusal', async () => {
    vi.spyOn(fakeBrowser.permissions, 'request').mockResolvedValue(false as never)

    expect(await ensureApiAccess()).toBe(false)
  })

  it('treats a failing request as a refusal', async () => {
    vi.spyOn(fakeBrowser.permissions, 'request').mockRejectedValue(new Error('No user gesture'))

    expect(await ensureApiAccess()).toBe(false)
  })
})
