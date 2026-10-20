import DOMPurify from 'dompurify'

// Elements that can run code, submit data, pull in remote content or style the page.
const FORBID_TAGS = [
  'script',
  'style',
  'link',
  'meta',
  'base',
  'iframe',
  'frame',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'noscript',
  'template',
]

// `srcset`/`sizes` point at extra, often relative, image candidates; `src` is enough to keep.
const FORBID_ATTR = ['style', 'class', 'id', 'srcset', 'sizes', 'target', 'ping']

const URL_ATTRIBUTES = ['href', 'src', 'cite', 'poster']
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

const purify = DOMPurify()

/** Resolves `value` against `baseUrl`; null when it isn't a safe, absolute link. */
const absoluteUrl = (value: string, baseUrl: string, allowData: boolean): string | null => {
  try {
    const url = new URL(value.trim(), baseUrl)
    if (SAFE_PROTOCOLS.has(url.protocol) || (allowData && url.protocol === 'data:')) return url.href
  } catch {
    // Unparseable URLs are dropped below.
  }
  return null
}

/**
 * Sanitizes extracted HTML so it is safe to store and render later: no scripts, styles,
 * handlers, forms or embeds, and every link and image URL absolute. Runs in the page context,
 * before anything is handed to the extension.
 */
export const sanitize = (html: string, baseUrl: string): string => {
  purify.addHook('afterSanitizeAttributes', (node) => {
    for (const name of URL_ATTRIBUTES) {
      const value = node.getAttribute(name)
      if (value === null) continue

      // Inline images survive (DOMPurify already limits data: to media elements).
      const resolved = absoluteUrl(value, baseUrl, name === 'src' && node.tagName === 'IMG')
      if (resolved) node.setAttribute(name, resolved)
      else node.removeAttribute(name)
    }
  })

  try {
    return purify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS,
      FORBID_ATTR,
    })
  } finally {
    // The hook closes over this call's baseUrl.
    purify.removeHook('afterSanitizeAttributes')
  }
}
