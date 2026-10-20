import { describe, expect, it } from 'vitest'
import { readabilityExtractor } from '@/lib/extract/readability'
import { loadFixture } from '../../helpers'

describe('readabilityExtractor', () => {
  it('extracts the article body without nav, comments or footer', () => {
    const result = readabilityExtractor.extract(loadFixture('article'))

    expect(result?.text).toContain('ARTICLE-START-MARKER')
    expect(result?.text).toContain('ARTICLE-END-MARKER')
    for (const marker of ['NAV-MARKER', 'COMMENTS-MARKER', 'FOOTER-MARKER']) {
      expect(result?.text).not.toContain(marker)
    }
  })

  it('reads article metadata', () => {
    expect(readabilityExtractor.extract(loadFixture('article'))?.meta).toMatchObject({
      byline: 'Ana Petrović',
      siteName: 'Example Rail Journal',
      lang: 'en',
      publishedTime: '2026-09-14T08:30:00Z',
    })
  })

  it('does not mutate the document it reads', () => {
    const doc = loadFixture('article')
    const before = doc.documentElement.outerHTML

    readabilityExtractor.extract(doc)

    expect(doc.documentElement.outerHTML).toBe(before)
  })

  it("leaves pages that don't look like articles to the fallback", () => {
    expect(readabilityExtractor.extract(loadFixture('non-readerable'))).toBeNull()
  })

  it('returns null when there is no content', () => {
    const doc = new DOMParser().parseFromString('<html><body></body></html>', 'text/html')
    expect(readabilityExtractor.extract(doc)).toBeNull()
  })
})
