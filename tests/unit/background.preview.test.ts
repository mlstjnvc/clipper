import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { NO_TEXT_MESSAGE, previewTab } from '@/lib/background/preview'
import { makePage, makePreview } from '../factories'

const page = makePage()

const injectionReturns = (result: unknown) =>
  vi
    .spyOn(fakeBrowser.scripting, 'executeScript')
    .mockResolvedValue([{ documentId: 'doc', frameId: 0, result }] as never)

describe('previewTab', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    vi.restoreAllMocks()
    vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({ url: 'https://example.com/a' } as never)
  })

  it('does not inject into pages that cannot be clipped', async () => {
    vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({ url: 'chrome://extensions' } as never)
    const executeScript = injectionReturns(page)

    expect(await previewTab(7)).toEqual({ status: 'not-clippable' })
    expect(executeScript).not.toHaveBeenCalled()
  })

  it('still tries the injection when the tab URL is unknown', async () => {
    vi.spyOn(fakeBrowser.tabs, 'get').mockRejectedValue(new Error('No tab with id: 7'))
    injectionReturns(page)

    expect(await previewTab(7)).toEqual({ status: 'ok', page: makePreview() })
  })

  it('injects the bundled extractor and returns a preview without the content', async () => {
    const executeScript = injectionReturns(page)

    expect(await previewTab(7)).toEqual({ status: 'ok', page: makePreview() })
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 7 }, files: ['/extract.js'] })
  })

  it('reports pages the browser refuses to inject into as not clippable', async () => {
    vi.spyOn(fakeBrowser.scripting, 'executeScript').mockRejectedValue(
      new Error('Cannot access a chrome:// URL'),
    )

    expect(await previewTab(7)).toEqual({ status: 'not-clippable' })
  })

  it('reports an error when the extractor found nothing', async () => {
    injectionReturns(null)

    expect(await previewTab(7)).toEqual({ status: 'error', message: NO_TEXT_MESSAGE })
  })
})
