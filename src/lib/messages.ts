import type { Credentials } from '@/lib/api/auth'
import type { SavedClip } from '@/lib/api/clips'
import type { ApiError, AuthUser } from '@/types/api'
import type { PagePreview } from '@/types/extracted-page'

export type PreviewResult =
  | { status: 'ok'; page: PagePreview }
  | { status: 'not-clippable' }
  | { status: 'error'; message: string }

export type SaveResult =
  | { status: 'saved'; clip: SavedClip }
  | { status: 'failed'; error: ApiError }
  | { status: 'not-clippable' }
  | { status: 'error'; message: string }

export type AuthStatus = { signedIn: true; user: AuthUser } | { signedIn: false }

export type SignInResult = { ok: true; user: AuthUser } | { ok: false; error: ApiError }

type NoPayload = Record<string, never>

/** Every popup → background message, with its payload and response. */
export interface Messages {
  'auth:status': { request: NoPayload; response: AuthStatus }
  'auth:sign-in': { request: Credentials; response: SignInResult }
  'auth:sign-out': { request: NoPayload; response: { ok: true } }
  'clip:preview': { request: { tabId: number }; response: PreviewResult }
  'clip:save': { request: { tabId: number }; response: SaveResult }
}

export type MessageType = keyof Messages

interface Envelope<K extends MessageType = MessageType> {
  type: K
  payload: Messages[K]['request']
}

export type Handlers = {
  [K in MessageType]: (payload: Messages[K]['request']) => Promise<Messages[K]['response']>
}

const isEnvelope = (message: unknown): message is Envelope =>
  typeof message === 'object' &&
  message !== null &&
  'type' in message &&
  typeof message.type === 'string'

export const sendMessage = <K extends MessageType>(
  type: K,
  payload: Messages[K]['request'],
): Promise<Messages[K]['response']> => browser.runtime.sendMessage({ type, payload })

export const listen = (handlers: Handlers) =>
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id || !isEnvelope(message)) return false
    if (!Object.hasOwn(handlers, message.type)) return false

    const handler = handlers[message.type] as (payload: unknown) => Promise<unknown>
    handler(message.payload).then(sendResponse, (error: unknown) =>
      sendResponse({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    )
    // Async reply via sendResponse: not every supported browser accepts a returned promise.
    return true
  })
