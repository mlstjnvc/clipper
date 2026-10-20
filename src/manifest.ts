export const EXTENSION_NAME = 'dlmnt-clipper'
export const GECKO_ID = 'clipper@dlmnt'

// Placeholders until design supplies real icons.
const ICONS = {
  16: 'icons/16.png',
  32: 'icons/32.png',
  48: 'icons/48.png',
  128: 'icons/128.png',
}

export interface ManifestEnv {
  apiUrl: string | undefined
  mode: string
  browser: string
}

/**
 * Turns `WXT_API_URL` into the single host permission the extension needs. Failing here, at
 * build time, beats shipping an extension that can't reach its API.
 */
export const apiHostPermission = (apiUrl: string | undefined): string => {
  if (!apiUrl) throw new Error('WXT_API_URL is not set. Copy .env.example to .env.<mode>.')

  let url: URL
  try {
    url = new URL(apiUrl)
  } catch {
    throw new Error(`WXT_API_URL is not a valid URL: "${apiUrl}"`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`WXT_API_URL must be http(s), got "${url.protocol}"`)
  }

  // Match patterns can't carry a port; the origin's host covers every port on it.
  return `${url.protocol}//${url.hostname}/*`
}

// Vite's `development` mode is what the spec calls the local environment.
const ENV_LABELS: Record<string, string> = { development: 'local' }

// Non-production builds carry their env in the name so they can be installed side by side.
export const extensionName = (mode: string): string =>
  mode === 'production' ? EXTENSION_NAME : `${EXTENSION_NAME} (${ENV_LABELS[mode] ?? mode})`

export const buildManifest = ({ apiUrl, mode, browser }: ManifestEnv) => ({
  name: extensionName(mode),
  description: 'Extract the readable text of a page and save it to dlmnt.',
  permissions: ['activeTab', 'scripting', 'storage'],
  host_permissions: [apiHostPermission(apiUrl)],
  icons: ICONS,
  action: { default_title: EXTENSION_NAME, default_icon: ICONS },
  ...(browser === 'firefox' && {
    browser_specific_settings: {
      gecko: {
        id: GECKO_ID,
        // 142 is the first Firefox (desktop and Android) to support data_collection_permissions.
        strict_min_version: '142.0',
        // Declared for AMO's built-in consent: a clip sends the page's content and URL, and
        // sign-in sends the user's email and password, to the dlmnt backend.
        data_collection_permissions: {
          required: [
            'websiteContent',
            'browsingActivity',
            'authenticationInfo',
            'personallyIdentifyingInfo',
          ],
        },
      },
    },
  }),
})
