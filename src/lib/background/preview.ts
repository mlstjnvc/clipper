import type { PreviewResult } from '@/lib/messages'
import { toPreview } from '@/types/extracted-page'
import { extractTab } from './pages'

export { NO_TEXT_MESSAGE } from './pages'

/** Extracts the tab and returns what the popup shows; the full page stays cached for saving. */
export const previewTab = async (tabId: number): Promise<PreviewResult> => {
  const result = await extractTab(tabId)
  return result.status === 'ok' ? { status: 'ok', page: toPreview(result.page) } : result
}
