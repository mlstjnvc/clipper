import { describe, expect, it } from 'vitest'
import { extractPage } from '@/lib/extract'
import type { Extractor } from '@/lib/extract/types'
import type { ExtractedPage } from '@/types/extracted-page'
import { loadFixture } from '../../helpers'

const URL_ = 'https://example.com/articles/night-trains'

describe('extractPage', () => {
  it('returns the full ExtractedPage for an article', () => {
    const page = extractPage(loadFixture('article', URL_), URL_)

    expect(page).toEqual({
      url: URL_,
      title: 'The Quiet Return of the Night Train',
      byline: 'Ana Petrović',
      siteName: 'Example Rail Journal',
      lang: 'en',
      publishedTime: '2026-09-14T08:30:00Z',
      excerpt: expect.any(String),
      html: expect.stringContaining('<p>'),
      text: expect.stringContaining('ARTICLE-START-MARKER'),
      markdown: expect.stringContaining('## Why travellers are coming back'),
      wordCount: expect.any(Number),
      method: 'readability',
      readerable: true,
    } satisfies Record<keyof ExtractedPage, unknown>)
  })

  it('produces clean paragraphs in text', () => {
    const { text = '', wordCount = 0 } = extractPage(loadFixture('article', URL_), URL_) ?? {}

    expect(text).not.toMatch(/\n{3,}/)
    expect(text).not.toMatch(/ {2,}/)
    expect(text).toContain('\n\nThat story has reversed.')
    expect(wordCount).toBeGreaterThan(250)
  })

  it('sanitizes what the extractor returned', () => {
    const page = extractPage(loadFixture('hostile', URL_), URL_)

    expect(page?.html).not.toMatch(/<script|onclick|onerror|javascript:/)
    expect(page?.html).toContain('href="https://example.com/relative/path?x=1#y"')
  })

  it('skips extractors that throw or find nothing and uses the next one', () => {
    const throwing: Extractor = {
      method: 'selection',
      extract: () => {
        throw new Error('boom')
      },
    }
    const empty: Extractor = { method: 'readability', extract: () => null }
    const blank: Extractor = {
      method: 'readability',
      extract: () => ({ html: '<p> </p>', text: ' ', meta: {} }),
    }
    const working: Extractor = {
      method: 'fallback',
      extract: () => ({ html: '<p>Hello there</p>', text: 'Hello there', meta: {} }),
    }

    const page = extractPage(loadFixture('article', URL_), URL_, [throwing, empty, blank, working])

    expect(page).toMatchObject({ method: 'fallback', text: 'Hello there', wordCount: 2 })
  })

  it('fills metadata from the document head when the extractor has none', () => {
    const working: Extractor = {
      method: 'fallback',
      extract: () => ({ html: '<p>Hello</p>', text: 'Hello', meta: { title: '  ' } }),
    }

    expect(extractPage(loadFixture('article', URL_), URL_, [working])).toMatchObject({
      title: 'The Quiet Return of the Night Train | Example Rail Journal',
      byline: 'Ana Petrović',
      siteName: 'Example Rail Journal',
      excerpt: 'Sleeper services are coming back across Europe.',
    })
  })

  it('returns null when no extractor finds anything', () => {
    expect(extractPage(loadFixture('article', URL_), URL_, [])).toBeNull()
  })
})
