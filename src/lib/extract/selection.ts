import type { Extractor } from './types'

/** What the user highlighted, if anything. Only works on the live document. */
export const selectionExtractor: Extractor = {
  method: 'selection',
  extract: (doc) => {
    const selection = doc.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return null

    const container = doc.createElement('div')
    for (let i = 0; i < selection.rangeCount; i++) {
      container.append(selection.getRangeAt(i).cloneContents())
    }
    return { html: container.innerHTML, text: selection.toString(), meta: {} }
  },
}
