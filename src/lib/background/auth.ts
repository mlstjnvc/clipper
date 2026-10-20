import { requestToken, revokeToken, type Credentials } from '@/lib/api/auth'
import type { AuthStatus, SignInResult } from '@/lib/messages'
import { clearAuth, getAuth, setAuth } from '@/lib/storage'

export const authStatus = async (): Promise<AuthStatus> => {
  const auth = await getAuth()
  return auth ? { signedIn: true, user: auth.user } : { signedIn: false }
}

export const signIn = async (credentials: Credentials): Promise<SignInResult> => {
  const result = await requestToken(credentials)
  if (!result.ok) return { ok: false, error: result.error }

  await setAuth(result.data)
  return { ok: true, user: result.data.user }
}

/** Revokes the token on the server when possible; the local sign-in is cleared regardless. */
export const signOut = async (): Promise<{ ok: true }> => {
  await revokeToken()
  await clearAuth()
  return { ok: true }
}
