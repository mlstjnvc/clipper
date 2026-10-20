export type ExtractionMethod = 'selection' | 'readability' | 'fallback'

/** What the injected extractor returns to the background. See SPEC → Data shapes. */
export interface ExtractedPage {
  url: string
  title: string
  byline: string | null
  siteName: string | null
  lang: string | null
  publishedTime: string | null
  excerpt: string | null
  /** DOMPurify-sanitized, absolute URLs, no scripts/styles/handlers. */
  html: string
  /** Plain text, whitespace-normalized. */
  text: string
  /** Turndown over `html`. */
  markdown: string
  wordCount: number
  method: ExtractionMethod
  /** `isProbablyReaderable()` result; informational only. */
  readerable: boolean
}

/** The part of an `ExtractedPage` the popup shows; the full page stays in the background. */
export type PagePreview = Pick<
  ExtractedPage,
  'url' | 'title' | 'byline' | 'siteName' | 'excerpt' | 'wordCount' | 'method' | 'readerable'
>

export const toPreview = ({
  url,
  title,
  byline,
  siteName,
  excerpt,
  wordCount,
  method,
  readerable,
}: ExtractedPage): PagePreview => ({
  url,
  title,
  byline,
  siteName,
  excerpt,
  wordCount,
  method,
  readerable,
})
