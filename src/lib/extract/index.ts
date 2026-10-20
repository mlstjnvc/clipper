import { isProbablyReaderable } from '@mozilla/readability'
import type { ExtractedPage } from '@/types/extracted-page'
import { documentMeta } from './meta'
import { countWords, htmlToText } from './normalize'
import { fallbackExtractor } from './fallback'
import { readabilityExtractor } from './readability'
import { sanitize } from './sanitize'
import { selectionExtractor } from './selection'
import { toMarkdown } from './toMarkdown'
import type { ExtractedMeta, Extractor, ExtractorResult } from './types'

// A selection is an explicit choice, so it wins; the page's raw text is the last resort.
export const EXTRACTORS: Extractor[] = [selectionExtractor, readabilityExtractor, fallbackExtractor]

const clean = (value: string | null | undefined): string | null => value?.trim() || null

// Extractor-specific values win; the document head fills the gaps.
const mergeMeta = (preferred: ExtractedMeta, fallback: ExtractedMeta): ExtractedMeta => ({
  title: clean(preferred.title) ?? clean(fallback.title),
  byline: clean(preferred.byline) ?? clean(fallback.byline),
  siteName: clean(preferred.siteName) ?? clean(fallback.siteName),
  lang: clean(preferred.lang) ?? clean(fallback.lang),
  publishedTime: clean(preferred.publishedTime) ?? clean(fallback.publishedTime),
  excerpt: clean(preferred.excerpt) ?? clean(fallback.excerpt),
})

const toPage = (
  doc: Document,
  url: string,
  extractor: Extractor,
  result: ExtractorResult,
): ExtractedPage | null => {
  const html = sanitize(result.html, doc.baseURI || url)
  const text = htmlToText(html)
  if (!text) return null

  const meta = mergeMeta(result.meta, documentMeta(doc))
  return {
    url,
    title: meta.title ?? url,
    byline: meta.byline ?? null,
    siteName: meta.siteName ?? null,
    lang: meta.lang ?? null,
    publishedTime: meta.publishedTime ?? null,
    excerpt: meta.excerpt ?? null,
    html,
    text,
    markdown: toMarkdown(html),
    wordCount: countWords(text),
    method: extractor.method,
    readerable: isReaderable(doc),
  }
}

const isReaderable = (doc: Document): boolean => {
  try {
    return isProbablyReaderable(doc)
  } catch {
    return false
  }
}

/**
 * Runs the extractors in order and returns the first usable result. An extractor that throws
 * or finds nothing hands over to the next, so one bad heuristic never blocks a clip.
 */
export const extractPage = (
  doc: Document,
  url: string,
  extractors: Extractor[] = EXTRACTORS,
): ExtractedPage | null => {
  for (const extractor of extractors) {
    try {
      const result = extractor.extract(doc)
      const page = result && toPage(doc, url, extractor, result)
      if (page) return page
    } catch {
      // Fall through to the next extractor.
    }
  }
  return null
}
