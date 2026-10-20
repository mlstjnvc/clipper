import { createClip, type ClipPayload } from '@/lib/api/clips'
import type { SaveResult } from '@/lib/messages'
import { cachedPage, extractTab, forgetPage } from './pages'

/** dlmnt-be rejects bodies over 5 MB; checking first saves uploading them. */
export const MAX_BODY_BYTES = 5 * 1024 * 1024

const bodySize = (payload: ClipPayload): number =>
  new TextEncoder().encode(JSON.stringify(payload)).length

/**
 * Saves the tab's page to dlmnt. Runs in the background, so it completes even if the popup
 * is closed mid-save.
 */
export const saveTab = async (tabId: number): Promise<SaveResult> => {
  let page = cachedPage(tabId)
  if (!page) {
    const extracted = await extractTab(tabId)
    if (extracted.status !== 'ok') return extracted
    page = extracted.page
  }

  const payload: ClipPayload = { ...page, clippedAt: new Date().toISOString() }
  if (bodySize(payload) > MAX_BODY_BYTES) {
    return { status: 'failed', error: { kind: 'too-large', status: null, message: null } }
  }

  const result = await createClip(payload)
  if (!result.ok) return { status: 'failed', error: result.error }

  forgetPage(tabId)
  return { status: 'saved', clip: result.data }
}
