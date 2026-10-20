import { vi } from 'vitest'

export const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Replaces global fetch for the test; returns the mock so calls can be inspected. */
export const mockFetch = (...responses: (Response | Error)[]) => {
  const fetch = vi.fn<typeof globalThis.fetch>()
  for (const response of responses) {
    if (response instanceof Error) fetch.mockRejectedValueOnce(response)
    else fetch.mockResolvedValueOnce(response)
  }
  vi.stubGlobal('fetch', fetch)
  return fetch
}

export const requestOf = (fetch: ReturnType<typeof mockFetch>, call = 0) => {
  const [url, init] = fetch.mock.calls[call] ?? []
  return {
    url: String(url),
    method: init?.method,
    headers: (init?.headers ?? {}) as Record<string, string>,
    body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
  }
}
