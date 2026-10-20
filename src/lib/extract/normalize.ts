const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DD',
  'DETAILS',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'SUMMARY',
  'TABLE',
  'TR',
  'UL',
])

/**
 * Cleans up plain text: unifies line endings and non-breaking spaces, collapses runs of
 * spaces, trims every line and keeps at most one blank line between paragraphs.
 */
export const normalizeText = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

/**
 * Plain text from (sanitized) HTML with paragraph breaks kept. `textContent` would glue
 * paragraphs together or keep the source's indentation, depending on how the page was written.
 */
export const htmlToText = (html: string): string => {
  const body = new DOMParser().parseFromString(html, 'text/html').body
  let out = ''

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += (node.textContent ?? '').replace(/\s+/g, ' ')
      return
    }
    if (!(node instanceof Element)) return
    if (node.tagName === 'BR') {
      out += '\n'
      return
    }
    if (node.tagName === 'PRE') {
      out += `\n\n${node.textContent ?? ''}\n\n`
      return
    }

    const block = BLOCK_TAGS.has(node.tagName)
    if (block) out += '\n\n'
    node.childNodes.forEach(walk)
    if (block) out += '\n\n'
    else if (node.tagName === 'TD' || node.tagName === 'TH') out += ' '
  }

  body.childNodes.forEach(walk)
  return normalizeText(out)
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Wraps plain text in paragraphs so text-only extractions still have an `html` form. */
export const textToHtml = (text: string): string =>
  normalizeText(text)
    .split('\n\n')
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')

export const countWords = (text: string): number => text.split(/\s+/).filter(Boolean).length
