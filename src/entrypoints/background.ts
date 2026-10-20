import { authStatus, signIn, signOut } from '@/lib/background/auth'
import { watchTabs } from '@/lib/background/pages'
import { previewTab } from '@/lib/background/preview'
import { saveTab } from '@/lib/background/save'
import { listen } from '@/lib/messages'

export default defineBackground(() => {
  watchTabs()

  listen({
    'auth:status': () => authStatus(),
    'auth:sign-in': (credentials) => signIn(credentials),
    'auth:sign-out': () => signOut(),
    'clip:preview': ({ tabId }) => previewTab(tabId),
    'clip:save': ({ tabId }) => saveTab(tabId),
  })
})
