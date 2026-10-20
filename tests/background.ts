import { vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'
import type { MessageType, Messages } from '@/lib/messages'

type Replies = {
  [K in MessageType]?:
    | Messages[K]['response']
    | ((payload: Messages[K]['request']) => Messages[K]['response'] | Promise<never>)
}

/**
 * Stands in for the background: `runtime.sendMessage` answers each message type from
 * `replies` (a value, or a function of the payload). Unlisted types reject, like a missing
 * receiver would.
 */
export const fakeBackground = (replies: Replies) =>
  vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockImplementation((async (message: {
    type: MessageType
    payload: never
  }) => {
    const reply = replies[message.type]
    if (reply === undefined) throw new Error(`No reply for ${message.type}`)
    return typeof reply === 'function' ? (reply as (p: never) => unknown)(message.payload) : reply
  }) as never)

export const sentTypes = (spy: ReturnType<typeof fakeBackground>) =>
  spy.mock.calls.map(([message]) => (message as unknown as { type: string }).type)
