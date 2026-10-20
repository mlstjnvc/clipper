import type { ExtractionMethod } from '@/types/extracted-page'

/** Article metadata an extractor may know about; all optional. */
export interface ExtractedMeta {
  title?: string | null
  byline?: string | null
  siteName?: string | null
  lang?: string | null
  publishedTime?: string | null
  excerpt?: string | null
}

/** Raw result of one extractor, before sanitizing and conversion. */
export interface ExtractorResult {
  /** Unsanitized HTML of the extracted content. Must not leave the page context. */
  html: string
  text: string
  meta: ExtractedMeta
}

/**
 * One strategy in the extraction chain. Returning `null` hands over to the next extractor.
 * Extractors must not mutate `doc`.
 */
export interface Extractor {
  method: ExtractionMethod
  extract: (doc: Document) => ExtractorResult | null
}
