import { textToHtml } from './normalize'
import type { Extractor } from './types'

const NON_TEXT = 'script, style, noscript, template'

// `innerText` on the live page skips hidden elements and follows the rendered layout. Where it
// isn't available (no layout engine), fall back to the text of a copy without scripts and styles.
const visibleText = (body: HTMLElement): string => {
  if (typeof body.innerText === 'string') return body.innerText

  const copy = body.cloneNode(true) as HTMLElement
  copy.querySelectorAll(NON_TEXT).forEach((node) => node.remove())
  return copy.textContent ?? ''
}

/** Last resort: the page's visible text, so a clip is possible on any page with text. */
export const fallbackExtractor: Extractor = {
  method: 'fallback',
  extract: (doc) => {
    if (!doc.body) return null

    const text = visibleText(doc.body)
    if (!text.trim()) return null

    return { html: textToHtml(text), text, meta: {} }
  },
}
