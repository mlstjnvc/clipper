import { afterEach, describe, expect, it } from 'vitest'
import { extractPage } from '@/lib/extract'
import { selectionExtractor } from '@/lib/extract/selection'

const select = (...nodes: Node[]) => {
  const selection = document.getSelection()!
  selection.removeAllRanges()
  for (const node of nodes) {
    const range = document.createRange()
    range.selectNodeContents(node)
    selection.addRange(range)
  }
}

describe('selectionExtractor', () => {
  afterEach(() => {
    document.getSelection()?.removeAllRanges()
    document.body.innerHTML = ''
  })

  it('returns null when nothing is selected', () => {
    document.body.innerHTML = '<p>Some text</p>'
    expect(selectionExtractor.extract(document)).toBeNull()
  })

  it('returns null for a whitespace-only selection', () => {
    document.body.innerHTML = '<p id="s">   </p>'
    select(document.getElementById('s')!)
    expect(selectionExtractor.extract(document)).toBeNull()
  })

  it('returns the selected markup and text', () => {
    document.body.innerHTML = '<p>Before</p><p id="s">Picked <em>words</em></p><p>After</p>'
    select(document.getElementById('s')!)

    expect(selectionExtractor.extract(document)).toEqual({
      html: 'Picked <em>words</em>',
      text: 'Picked words',
      meta: {},
    })
  })
})

describe('extractPage with a selection', () => {
  afterEach(() => {
    document.getSelection()?.removeAllRanges()
    document.body.innerHTML = ''
  })

  it('prefers the selection over the article', () => {
    document.title = 'Article page'
    document.body.innerHTML = `<article><h1>Article</h1>${'<p>Long article text. '.repeat(80)}</p>
      <p id="s">Only this sentence.</p></article>`
    select(document.getElementById('s')!)

    expect(extractPage(document, 'https://example.com/a')).toMatchObject({
      method: 'selection',
      text: 'Only this sentence.',
      html: 'Only this sentence.',
      title: 'Article page',
      wordCount: 3,
    })
  })
})
