import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import { listen, type Handlers } from '@/lib/messages'

const ownSender = () => ({ id: fakeBrowser.runtime.id })

// Calls the registered listener the way the browser would and resolves with its reply.
const dispatch = (message: unknown, sender: { id?: string } = ownSender()) =>
  new Promise<{ handled: unknown; reply?: unknown }>((resolve) => {
    void fakeBrowser.runtime.onMessage
      .trigger(message, sender, (reply: unknown) => resolve({ handled: true, reply }))
      .then(([handled]: unknown[]) => {
        if (handled !== true) resolve({ handled })
      })
  })

describe('listen', () => {
  let handlers: Handlers

  beforeEach(() => {
    fakeBrowser.reset()
    handlers = {
      'auth:status': vi.fn(async () => ({ signedIn: false as const })),
      'auth:sign-in': vi.fn(),
      'auth:sign-out': vi.fn(async () => ({ ok: true as const })),
      'clip:preview': vi.fn(async () => ({ status: 'not-clippable' as const })),
      'clip:save': vi.fn(),
    }
    listen(handlers)
  })

  it('routes a message to its handler and replies with the result', async () => {
    const result = await dispatch({ type: 'clip:preview', payload: { tabId: 3 } })

    expect(handlers['clip:preview']).toHaveBeenCalledWith({ tabId: 3 })
    expect(result).toEqual({ handled: true, reply: { status: 'not-clippable' } })
  })

  it('replies with an error result when the handler throws', async () => {
    vi.mocked(handlers['clip:preview']).mockRejectedValue(new Error('boom'))

    const result = await dispatch({ type: 'clip:preview', payload: { tabId: 3 } })

    expect(result.reply).toEqual({ status: 'error', message: 'boom' })
  })

  it.each([
    ['unknown types', { type: 'nope', payload: {} }, ownSender()],
    ['malformed messages', 'clip:preview', ownSender()],
    ['other extensions', { type: 'clip:preview', payload: { tabId: 3 } }, { id: 'someone-else' }],
  ])('ignores %s', async (_, message, sender) => {
    expect(await dispatch(message, sender)).toEqual({ handled: false })
    expect(handlers['clip:preview']).not.toHaveBeenCalled()
  })
})
