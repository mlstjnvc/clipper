import { storage } from 'wxt/utils/storage'
import type { StoredAuth } from '@/types/api'

// `local:`, never `sync:` — a token must not follow the user to other devices.
const authItem = storage.defineItem<StoredAuth | null>('local:auth', { fallback: null })

export const isExpired = (auth: StoredAuth, now = Date.now()): boolean =>
  !(Date.parse(auth.expiresAt) > now)

/** The stored sign-in, or null when there is none or it has expired (expired ones are removed). */
export const getAuth = async (): Promise<StoredAuth | null> => {
  const auth = await authItem.getValue()
  if (auth && isExpired(auth)) {
    await clearAuth()
    return null
  }
  return auth
}

export const setAuth = (auth: StoredAuth): Promise<void> => authItem.setValue(auth)

export const clearAuth = (): Promise<void> => authItem.removeValue()
