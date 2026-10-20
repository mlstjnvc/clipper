import { describe, expect, it } from 'vitest'
import { countWords, htmlToText, normalizeText, textToHtml } from '@/lib/extract/normalize'

describe('normalizeText', () => {
  it('unifies line endings and non-breaking spaces and collapses runs of spaces', () => {
    expect(normalizeText('a  b\r\nc\td')).toBe('a b\nc d')
  })

  it('keeps at most one blank line and trims lines and the result', () => {
    expect(normalizeText('  one  \n\n\n\n  two \n')).toBe('one\n\ntwo')
  })
})

describe('htmlToText', () => {
  it('separates blocks with a blank line and keeps <br> as a line break', () => {
    expect(htmlToText('<h1>Title</h1><p>First\n   paragraph</p><p>Line<br>break</p>')).toBe(
      'Title\n\nFirst paragraph\n\nLine\nbreak',
    )
  })

  it('puts list items and table cells on readable lines', () => {
    expect(
      htmlToText('<ul><li>a</li><li>b</li></ul><table><tr><td>1</td><td>2</td></tr></table>'),
    ).toBe('a\n\nb\n\n1 2')
  })

  it('keeps the whitespace inside <pre>', () => {
    expect(htmlToText('<pre>x\ny</pre>')).toBe('x\ny')
  })
})

describe('textToHtml', () => {
  it('wraps paragraphs and escapes markup', () => {
    expect(textToHtml('a <b>\nline\n\n\nnext & last')).toBe(
      '<p>a &lt;b&gt;<br>line</p><p>next &amp; last</p>',
    )
  })
})

describe('countWords', () => {
  it.each([
    ['', 0],
    ['  one  ', 1],
    ['one two\nthree\tfour', 4],
  ])('%j → %i', (text, count) => {
    expect(countWords(text)).toBe(count)
  })
})
