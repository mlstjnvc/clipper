import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Parses `tests/fixtures/pages/<name>.html` into a standalone Document. A `<base>` stands in
 * for the page URL so relative links resolve as they would on the live page.
 */
export const loadFixture = (name: string, url = 'https://example.com/articles/night-trains') => {
  const html = readFileSync(resolve('tests/fixtures/pages', `${name}.html`), 'utf-8')
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const base = doc.createElement('base')
  base.href = url
  doc.head.prepend(base)
  return doc
}
