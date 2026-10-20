import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { cachedPage, extractTab, forgetPage, watchTabs } from '@/lib/background/pages'
import { MAX_BODY_BYTES, saveTab } from '@/lib/background/save'
import { getAuth, setAuth } from '@/lib/storage'
import { makePage } from '../factories'
import { jsonResponse, mockFetch, requestOf } from '../fetch'

const TAB = 7

const injectionReturns = (result: unknown) =>
  vi
    .spyOn(fakeBrowser.scripting, 'executeScript')
    .mockResolvedValue([{ documentId: 'doc', frameId: 0, result }] as never)

const signIn = () =>
  setAuth({
    token: '1|secret',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    user: { id: 'u1', name: 'Ana', email: 'ana@example.com' },
  })

describe('saveTab', () => {
  beforeEach(async () => {
    fakeBrowser.reset()
    vi.restoreAllMocks()
    forgetPage(TAB)
    vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({ url: 'https://example.com/a' } as never)
    await signIn()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('saves the page cached by the preview without re-reading the tab', async () => {
    const page = makePage()
    injectionReturns(page)
    await extractTab(TAB)
    const executeScript = vi.mocked(fakeBrowser.scripting.executeScript)
    executeScript.mockClear()
    const fetch = mockFetch(
      jsonResponse(201, { success: true, data: { id: 'c1', createdAt: 'x' } }),
    )

    const result = await saveTab(TAB)

    expect(result).toEqual({ status: 'saved', clip: { id: 'c1', createdAt: 'x' } })
    expect(executeScript).not.toHaveBeenCalled()
    expect(requestOf(fetch).body).toEqual({ ...page, clippedAt: expect.any(String) })
    expect(Date.parse(requestOf(fetch).body.clippedAt)).not.toBeNaN()
  })

  it('forgets the page once it is saved', async () => {
    injectionReturns(makePage())
    await extractTab(TAB)
    mockFetch(jsonResponse(201, { success: true, data: { id: 'c1', createdAt: 'x' } }))

    await saveTab(TAB)

    expect(cachedPage(TAB)).toBeUndefined()
  })

  it('re-extracts when nothing is cached (e.g. the service worker restarted)', async () => {
    const executeScript = injectionReturns(makePage({ title: 'Fresh' }))
    const fetch = mockFetch(
      jsonResponse(201, { success: true, data: { id: 'c1', createdAt: 'x' } }),
    )

    expect(await saveTab(TAB)).toMatchObject({ status: 'saved' })
    expect(executeScript).toHaveBeenCalledTimes(1)
    expect(requestOf(fetch).body.title).toBe('Fresh')
  })

  it('passes on extraction problems', async () => {
    vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({ url: 'chrome://newtab' } as never)
    const fetch = mockFetch()

    expect(await saveTab(TAB)).toEqual({ status: 'not-clippable' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a page over 5 MB without uploading it', async () => {
    injectionReturns(makePage({ html: 'a'.repeat(MAX_BODY_BYTES) }))
    await extractTab(TAB)
    const fetch = mockFetch()

    expect(await saveTab(TAB)).toEqual({
      status: 'failed',
      error: { kind: 'too-large', status: null, message: null },
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('measures the size in bytes, not characters', async () => {
    // 'ž' is two bytes in UTF-8: under the limit in characters, over it in bytes.
    injectionReturns(makePage({ html: 'ž'.repeat(MAX_BODY_BYTES / 2 + 1) }))
    await extractTab(TAB)
    mockFetch()

    expect(await saveTab(TAB)).toMatchObject({ error: { kind: 'too-large' } })
  })

  it('keeps the page cached when saving fails, so Retry can resend it', async () => {
    injectionReturns(makePage())
    await extractTab(TAB)
    mockFetch(jsonResponse(429, { message: 'Too Many Attempts.' }))

    expect(await saveTab(TAB)).toMatchObject({ status: 'failed', error: { kind: 'throttled' } })
    expect(cachedPage(TAB)).toBeDefined()
  })

  it('reports an expired sign-in and clears it', async () => {
    injectionReturns(makePage())
    mockFetch(jsonResponse(401, { message: 'Unauthenticated.' }))

    expect(await saveTab(TAB)).toMatchObject({ status: 'failed', error: { kind: 'unauthorized' } })
    expect(await getAuth()).toBeNull()
  })
})

describe('watchTabs', () => {
  beforeEach(async () => {
    fakeBrowser.reset()
    vi.restoreAllMocks()
    vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({ url: 'https://example.com/a' } as never)
    injectionReturns(makePage())
    watchTabs()
    await extractTab(TAB)
  })

  it('forgets a tab that starts loading another page', async () => {
    await fakeBrowser.tabs.onUpdated.trigger(TAB, { status: 'loading' }, {} as never)

    expect(cachedPage(TAB)).toBeUndefined()
  })

  it('keeps the page on unrelated updates', async () => {
    await fakeBrowser.tabs.onUpdated.trigger(TAB, { title: 'New title' }, {} as never)

    expect(cachedPage(TAB)).toBeDefined()
  })

  it('forgets a closed tab', async () => {
    await fakeBrowser.tabs.onRemoved.trigger(TAB, {} as never)

    expect(cachedPage(TAB)).toBeUndefined()
  })
})
