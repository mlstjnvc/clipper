import { describe, expect, it } from 'vitest'
import { apiHostPermission, buildManifest, extensionName } from '@/manifest'

describe('apiHostPermission', () => {
  it('derives a host match pattern from the API URL', () => {
    expect(apiHostPermission('https://dlmnt.test/v3')).toBe('https://dlmnt.test/*')
  })

  it('drops the port, which match patterns cannot express', () => {
    expect(apiHostPermission('http://localhost:8000/v3')).toBe('http://localhost/*')
  })

  it.each([
    [undefined, /not set/],
    ['', /not set/],
    ['dlmnt.test/v3', /not a valid URL/],
    ['ftp://dlmnt.test', /must be http/],
  ])('rejects %j', (apiUrl, message) => {
    expect(() => apiHostPermission(apiUrl)).toThrow(message)
  })
})

describe('extensionName', () => {
  it.each([
    ['production', 'dlmnt-clipper'],
    ['development', 'dlmnt-clipper (local)'],
    ['stage', 'dlmnt-clipper (stage)'],
  ])('%s → %s', (mode, name) => {
    expect(extensionName(mode)).toBe(name)
  })
})

describe('buildManifest', () => {
  const env = { apiUrl: 'https://dlmnt.test/v3', mode: 'production' }

  it('requests only the permissions the spec allows', () => {
    const manifest = buildManifest({ ...env, browser: 'chrome' })

    expect(manifest.permissions).toEqual(['activeTab', 'scripting', 'storage'])
    expect(manifest.host_permissions).toEqual(['https://dlmnt.test/*'])
    expect(manifest).not.toHaveProperty('content_scripts')
  })

  it('adds the gecko id for Firefox only', () => {
    expect(buildManifest({ ...env, browser: 'firefox' })).toMatchObject({
      browser_specific_settings: {
        gecko: {
          id: 'clipper@dlmnt',
          data_collection_permissions: { required: expect.arrayContaining(['websiteContent']) },
        },
      },
    })
    expect(buildManifest({ ...env, browser: 'chrome' })).not.toHaveProperty(
      'browser_specific_settings',
    )
  })
})
