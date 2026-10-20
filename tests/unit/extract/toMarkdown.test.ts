import { describe, expect, it } from 'vitest'
import { toMarkdown } from '@/lib/extract/toMarkdown'

describe('toMarkdown', () => {
  it('uses ATX headings, emphasis, links and fenced code', () => {
    expect(
      toMarkdown(
        '<h1>Title</h1><p>Some <em>text</em> with <a href="https://x.example/">a link</a>.</p>' +
          '<pre><code>let a = 1</code></pre>',
      ),
    ).toBe('# Title\n\nSome _text_ with [a link](https://x.example/).\n\n```\nlet a = 1\n```')
  })

  it('writes lists with a single space after the marker', () => {
    expect(toMarkdown('<ul><li>one</li><li>two</li></ul>')).toBe('- one\n- two')
    expect(toMarkdown('<ol start="3"><li>three</li><li>four</li></ol>')).toBe('3. three\n4. four')
  })

  it('indents nested lists under their item', () => {
    expect(toMarkdown('<ul><li>parent<ul><li>child</li></ul></li><li>next</li></ul>')).toBe(
      '- parent\n  - child\n- next',
    )
  })
})
