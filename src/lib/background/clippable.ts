// Browsers refuse script injection on their own pages and their extension stores. Checking up
// front gives a clear "can't be clipped" instead of a failed injection.
const BLOCKED_PROTOCOLS = new Set([
  'about:',
  'chrome:',
  'chrome-extension:',
  'chrome-search:',
  'chrome-untrusted:',
  'devtools:',
  'edge:',
  'extension:',
  'moz-extension:',
  'resource:',
  'view-source:',
])

const STORE_PAGES: [host: string, pathPrefix: string][] = [
  ['chromewebstore.google.com', '/'],
  ['chrome.google.com', '/webstore'],
  ['microsoftedge.microsoft.com', '/addons'],
  ['addons.mozilla.org', '/'],
]

/**
 * Whether the extractor can run on `url`. Unknown URLs (the browser didn't share one) are
 * allowed; the injection itself is the final check.
 */
export const isClippableUrl = (url: string | undefined): boolean => {
  if (!url) return true

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (BLOCKED_PROTOCOLS.has(parsed.protocol)) return false
  if (
    STORE_PAGES.some(([host, path]) => parsed.hostname === host && parsed.pathname.startsWith(path))
  )
    return false
  // The built-in PDF viewers have no document to read.
  if (parsed.pathname.toLowerCase().endsWith('.pdf')) return false

  return true
}
