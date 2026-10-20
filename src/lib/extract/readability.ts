import { Readability, isProbablyReaderable } from '@mozilla/readability'
import type { Extractor } from './types'

export const readabilityExtractor: Extractor = {
  method: 'readability',
  extract: (doc) => {
    // On pages that don't look like articles Readability still returns its best guess, which is
    // often one block of a larger page. The full-text fallback is the more honest result there.
    if (!isProbablyReaderable(doc)) return null

    // Readability mutates the document it parses, so it always gets a clone.
    const article = new Readability(doc.cloneNode(true) as Document).parse()
    if (!article?.content || !article.textContent?.trim()) return null

    return {
      html: article.content,
      text: article.textContent,
      meta: {
        title: article.title,
        byline: article.byline,
        siteName: article.siteName,
        lang: article.lang,
        publishedTime: article.publishedTime,
        excerpt: article.excerpt,
      },
    }
  },
}
