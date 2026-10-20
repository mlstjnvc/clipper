import { describe, expect, it } from 'vitest'
import { sanitize } from '@/lib/extract/sanitize'
import { loadFixture } from '../../helpers'

const BASE = 'https://example.com/articles/hostile'

const sanitizedFixture = () => {
  const html = sanitize(loadFixture('hostile', BASE).body.innerHTML, BASE)
  return { html, doc: new DOMParser().parseFromString(html, 'text/html') }
}

describe('sanitize', () => {
  it('removes scripts, styles, frames, forms and SVG', () => {
    const { html } = sanitizedFixture()

    for (const tag of ['<script', '<style', '<iframe', '<form', '<input', '<button', '<svg']) {
      expect(html).not.toContain(tag)
    }
  })

  it('removes event handlers, inline styles, classes and ids', () => {
    const { doc } = sanitizedFixture()

    for (const element of doc.body.querySelectorAll('*')) {
      for (const { name } of element.attributes) {
        expect(name).not.toMatch(/^on|^style$|^class$|^id$|^srcset$/)
      }
    }
  })

  it('makes every link and image URL absolute and drops unsafe ones', () => {
    const { doc } = sanitizedFixture()
    const hrefs = [...doc.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    const srcs = [...doc.querySelectorAll('img')].map((img) => img.getAttribute('src'))

    expect(hrefs).toEqual([
      null, // javascript:
      'https://example.com/relative/path?x=1#y',
      'https://cdn.example.org/protocol-relative',
      'mailto:editor@example.com',
      null, // data: on a link
    ])
    expect(srcs).toEqual([
      'https://example.com/articles/images/photo.jpg',
      'data:image/png;base64,iVBORw0KGgo=',
      null, // javascript:
    ])
  })

  it('keeps the text and structure', () => {
    const { doc } = sanitizedFixture()

    expect(doc.querySelector('h1')?.textContent).toBe('Hostile page')
    expect(doc.querySelectorAll('p').length).toBeGreaterThanOrEqual(3)
    expect(doc.querySelector('img')?.getAttribute('alt')).toBe('Photo')
  })

  it('resolves against the base URL of each call', () => {
    expect(sanitize('<a href="/a">a</a>', 'https://one.example/')).toContain(
      'https://one.example/a',
    )
    expect(sanitize('<a href="/a">a</a>', 'https://two.example/')).toContain(
      'https://two.example/a',
    )
  })
})
