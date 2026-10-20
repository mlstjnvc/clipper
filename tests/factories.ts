import { toPreview, type ExtractedPage, type PagePreview } from '@/types/extracted-page'

export const makePage = (overrides: Partial<ExtractedPage> = {}): ExtractedPage => ({
  url: 'https://example.com/articles/night-trains',
  title: 'Night trains',
  byline: 'Ana Petrović',
  siteName: 'Example Rail Journal',
  lang: 'en',
  publishedTime: '2026-09-14T08:30:00Z',
  excerpt: 'Sleeper services are coming back.',
  html: '<p>Sleeper services are coming back.</p>',
  text: 'Sleeper services are coming back.',
  markdown: 'Sleeper services are coming back.',
  wordCount: 412,
  method: 'readability',
  readerable: true,
  ...overrides,
})

export const makePreview = (overrides: Partial<ExtractedPage> = {}): PagePreview =>
  toPreview(makePage(overrides))
