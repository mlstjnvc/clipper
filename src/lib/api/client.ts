import { clearAuth, getAuth } from '@/lib/storage'
import type { ApiError, ApiErrorKind, ApiResult } from '@/types/api'

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: unknown
  token?: string
}

const STATUS_KINDS: Record<number, ApiErrorKind> = {
  401: 'unauthorized',
  403: 'forbidden',
  413: 'too-large',
  422: 'validation',
  429: 'throttled',
}

export const apiUrl = (path: string): string =>
  `${import.meta.env.WXT_API_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`

const readJson = async (response: Response): Promise<Record<string, unknown> | null> => {
  try {
    const json: unknown = await response.json()
    return typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const toError = (status: number, json: Record<string, unknown> | null): ApiError => ({
  kind: STATUS_KINDS[status] ?? 'server',
  status,
  message: typeof json?.message === 'string' ? json.message : null,
  ...(status === 422 &&
    typeof json?.errors === 'object' &&
    json.errors !== null && { fields: json.errors as Record<string, string[]> }),
})

/**
 * One call to the dlmnt API. Never throws: every outcome, including a network failure, comes
 * back as an `ApiResult`. Successful responses are unwrapped from dlmnt-be's `{ data }` envelope.
 */
export const apiRequest = async <T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions = {},
): Promise<ApiResult<T>> => {
  let response: Response
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch {
    return { ok: false, error: { kind: 'network', status: null, message: null } }
  }

  const json = await readJson(response)
  if (!response.ok) return { ok: false, error: toError(response.status, json) }

  return { ok: true, data: (json?.data ?? null) as T }
}

const UNAUTHORIZED: ApiError = { kind: 'unauthorized', status: null, message: null }

/**
 * `apiRequest` as the signed-in user. Without a valid stored token nothing is sent; a 401 means
 * the server revoked or expired it, so the stored sign-in is dropped.
 */
export const authorizedRequest = async <T>(
  path: string,
  options: Omit<RequestOptions, 'token'> = {},
): Promise<ApiResult<T>> => {
  const auth = await getAuth()
  if (!auth) return { ok: false, error: UNAUTHORIZED }

  const result = await apiRequest<T>(path, { ...options, token: auth.token })
  if (!result.ok && result.error.kind === 'unauthorized') await clearAuth()

  return result
}
