import TurndownService from 'turndown'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
})

// Turndown pads list markers to four columns (`-   item`); one space reads like hand-written
// Markdown. Continuation lines are indented to the marker's width so nesting still works.
turndown.addRule('listItem', {
  filter: 'li',
  replacement: (content, node, options) => {
    const parent = node.parentNode as Element | null
    let prefix = `${options.bulletListMarker} `
    if (parent?.nodeName === 'OL') {
      const start = Number(parent.getAttribute('start') ?? 1)
      prefix = `${start + Array.prototype.indexOf.call(parent.children, node)}. `
    }

    const indent = ' '.repeat(prefix.length)
    const body = content
      .replace(/^\n+/, '')
      .replace(/\n+$/, '\n')
      .replace(/\n(?!$)/g, `\n${indent}`)
    return prefix + body + (node.nextSibling && !body.endsWith('\n') ? '\n' : '')
  },
})

/** Markdown from sanitized HTML. */
export const toMarkdown = (html: string): string => turndown.turndown(html).trim()
