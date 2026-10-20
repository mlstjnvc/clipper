import type { ExtractedMeta } from './types'

const metaContent = (doc: Document, selectors: string[]): string | null => {
  for (const selector of selectors) {
    const value = doc.querySelector<HTMLMetaElement>(selector)?.content?.trim()
    if (value) return value
  }
  return null
}

/** Metadata straight from the document's head, for extractors that don't parse the article. */
export const documentMeta = (doc: Document): ExtractedMeta => ({
  title: doc.title.trim() || null,
  byline: metaContent(doc, ['meta[name="author"]', 'meta[property="article:author"]']),
  siteName: metaContent(doc, ['meta[property="og:site_name"]']),
  lang: doc.documentElement.lang.trim() || null,
  publishedTime: metaContent(doc, ['meta[property="article:published_time"]']),
  excerpt: metaContent(doc, ['meta[name="description"]', 'meta[property="og:description"]']),
})
