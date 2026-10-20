import { describe, expect, it } from 'vitest'
import { isClippableUrl } from '@/lib/background/clippable'

describe('isClippableUrl', () => {
  it.each([
    'https://example.com/articles/night-trains',
    'http://localhost:3000/',
    'https://chrome.google.com/search',
    'https://example.com/report.pdf.html',
    undefined,
  ])('allows %s', (url) => {
    expect(isClippableUrl(url)).toBe(true)
  })

  it.each([
    'chrome://extensions',
    'edge://settings',
    'about:addons',
    'about:blank',
    'chrome-extension://abc/popup.html',
    'moz-extension://abc/popup.html',
    'view-source:https://example.com',
    'https://chromewebstore.google.com/detail/x',
    'https://chrome.google.com/webstore/detail/x',
    'https://microsoftedge.microsoft.com/addons/detail/x',
    'https://addons.mozilla.org/en-US/firefox/',
    'https://example.com/files/Report.PDF',
    'not a url',
  ])('blocks %s', (url) => {
    expect(isClippableUrl(url)).toBe(false)
  })
})
