import { apiHostPermission } from '@/manifest'

/**
 * Makes sure the extension may call the dlmnt API. Chrome and Edge grant host permissions at
 * install, so this resolves immediately; Firefox users can revoke them, and this asks again.
 *
 * Must be the first thing a click handler awaits: Firefox only shows the prompt while the
 * call is still part of the user's gesture.
 */
export const ensureApiAccess = (): Promise<boolean> =>
  browser.permissions
    .request({ origins: [apiHostPermission(import.meta.env.WXT_API_URL)] })
    .catch(() => false)
