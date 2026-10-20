import type { ExtractedPage } from '@/types/extracted-page'
import { isClippableUrl } from './clippable'

export const NO_TEXT_MESSAGE = "Couldn't find any text on this page."

export type ExtractResult =
  | { status: 'ok'; page: ExtractedPage }
  | { status: 'not-clippable' }
  | { status: 'error'; message: string }

// The page extracted for the preview, kept until it is saved so Save doesn't re-read the tab.
// In memory only: a restarted service worker just re-extracts.
const extracted = new Map<number, ExtractedPage>()

export const cachedPage = (tabId: number): ExtractedPage | undefined => extracted.get(tabId)

export const forgetPage = (tabId: number): void => {
  extracted.delete(tabId)
}

const tabUrl = async (tabId: number): Promise<string | undefined> => {
  try {
    return (await browser.tabs.get(tabId)).url
  } catch {
    return undefined
  }
}

/** Injects the bundled extractor into the tab and caches what it finds. */
export const extractTab = async (tabId: number): Promise<ExtractResult> => {
  if (!isClippableUrl(await tabUrl(tabId))) return { status: 'not-clippable' }

  let results
  try {
    results = await browser.scripting.executeScript({ target: { tabId }, files: ['/extract.js'] })
  } catch {
    // Anything the URL check missed: restricted hosts, sandboxed frames, closed tabs.
    return { status: 'not-clippable' }
  }

  const page = results[0]?.result as ExtractedPage | null | undefined
  if (!page) return { status: 'error', message: NO_TEXT_MESSAGE }

  extracted.set(tabId, page)
  return { status: 'ok', page }
}

/** Drops a tab's cached page once it navigates or closes, so a save never sends a stale page. */
export const watchTabs = (): void => {
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading' || changeInfo.url) forgetPage(tabId)
  })
  browser.tabs.onRemoved.addListener(forgetPage)
}
