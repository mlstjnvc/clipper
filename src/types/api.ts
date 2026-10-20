export type ApiErrorKind =
  'unauthorized' | 'forbidden' | 'too-large' | 'validation' | 'throttled' | 'network' | 'server'

export interface ApiError {
  kind: ApiErrorKind
  /** HTTP status, or null when the request never got a response. */
  status: number | null
  /** The server's message, when it sent one. */
  message: string | null
  /** Per-field validation errors (422). */
  fields?: Record<string, string[]>
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }

export interface AuthUser {
  id: string
  name: string
  email: string
}

/** What sign-in keeps in `storage.local`. */
export interface StoredAuth {
  token: string
  /** ISO 8601. */
  expiresAt: string
  user: AuthUser
}
