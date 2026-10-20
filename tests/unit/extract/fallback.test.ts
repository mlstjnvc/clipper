import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractPage } from '@/lib/extract'
import { fallbackExtractor } from '@/lib/extract/fallback'
import { loadFixture } from '../../helpers'

const URL_ = 'https://status.example.com/'

describe('fallbackExtractor', () => {
  afterEach(() => vi.restoreAllMocks())

  it('uses the page text without scripts or styles when there is no layout', () => {
    const result = fallbackExtractor.extract(loadFixture('non-readerable', URL_))

    expect(result?.text).toContain('VISIBLE-MARKER')
    expect(result?.text).not.toMatch(/SCRIPT-MARKER|STYLE-MARKER/)
  })

  it("uses the live page's innerText when the browser provides it", () => {
    const doc = loadFixture('non-readerable', URL_)
    Object.defineProperty(doc.body, 'innerText', { value: 'Rendered\n\ntext only' })

    expect(fallbackExtractor.extract(doc)).toEqual({
      html: '<p>Rendered</p><p>text only</p>',
      text: 'Rendered\n\ntext only',
      meta: {},
    })
  })

  it('returns null when the page has no text', () => {
    const doc = new DOMParser().parseFromString('<body><script>x()</script></body>', 'text/html')
    expect(fallbackExtractor.extract(doc)).toBeNull()
  })
})

describe('extractPage on pages Readability rejects', () => {
  it('falls back to the page text and labels it', () => {
    const page = extractPage(loadFixture('non-readerable', URL_), URL_)

    expect(page).toMatchObject({
      method: 'fallback',
      readerable: false,
      title: 'Status dashboard',
      excerpt: 'Service status at a glance.',
    })
    expect(page?.text).toContain('VISIBLE-MARKER')
  })

  it('returns null for an app shell with nothing but a noscript message', () => {
    expect(extractPage(loadFixture('spa', URL_), URL_)).toBeNull()
  })
})
