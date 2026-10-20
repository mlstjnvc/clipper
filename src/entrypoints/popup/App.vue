<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ClipPreview from '@/components/ClipPreview.vue'
import ClipStatus from '@/components/ClipStatus.vue'
import SignInForm from '@/components/SignInForm.vue'
import { EXTENSION_NAME } from '@/manifest'
import { saveErrorMessage } from '@/lib/errors'
import { sendMessage, type PreviewResult } from '@/lib/messages'
import type { AuthUser } from '@/types/api'

type Session =
  { status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; user: AuthUser }
type PreviewState = { status: 'extracting' } | PreviewResult
type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'error'; message: string }

const GENERIC_ERROR = 'Something went wrong. Please try again.'

const session = ref<Session>({ status: 'loading' })
const signInNotice = ref<string | null>(null)
const preview = ref<PreviewState>({ status: 'extracting' })
const save = ref<SaveState>({ status: 'idle' })
let tabId: number | undefined

const loadPreview = async () => {
  preview.value = { status: 'extracting' }
  save.value = { status: 'idle' }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  tabId = tab?.id
  if (tabId === undefined) {
    preview.value = { status: 'not-clippable' }
    return
  }

  preview.value = await sendMessage('clip:preview', { tabId }).catch((): PreviewResult => ({
    status: 'error',
    message: GENERIC_ERROR,
  }))
}

const saveClip = async () => {
  if (tabId === undefined || save.value.status === 'saving') return
  save.value = { status: 'saving' }

  const result = await sendMessage('clip:save', { tabId }).catch(() => null)
  if (!result) {
    save.value = { status: 'error', message: GENERIC_ERROR }
  } else if (result.status === 'saved') {
    save.value = { status: 'saved' }
  } else if (result.status === 'failed' && result.error.kind === 'unauthorized') {
    // The token expired or was revoked; the background has already dropped it.
    signInNotice.value = saveErrorMessage(result.error)
    session.value = { status: 'signed-out' }
  } else if (result.status === 'failed') {
    save.value = { status: 'error', message: saveErrorMessage(result.error) }
  } else {
    // The tab navigated away or lost its text between preview and save.
    preview.value = result
  }
}

const onSignedIn = (user: AuthUser) => {
  session.value = { status: 'signed-in', user }
  signInNotice.value = null
  void loadPreview()
}

// Signed out right away: the background revokes the token on the server and clears it locally
// whatever the outcome, so the popup doesn't wait on the network.
const signOut = () => {
  session.value = { status: 'signed-out' }
  void sendMessage('auth:sign-out', {}).catch(() => undefined)
}

onMounted(async () => {
  const status = await sendMessage('auth:status', {}).catch(() => ({ signedIn: false as const }))
  if (status.signedIn) onSignedIn(status.user)
  else session.value = { status: 'signed-out' }
})
</script>

<template>
  <main class="popup">
    <header class="popup__header">
      <span class="popup__brand">{{ EXTENSION_NAME }}</span>
      <span v-if="session.status === 'signed-in'" class="popup__account">
        <span class="popup__email" :title="session.user.email" data-test="account">
          {{ session.user.email }}
        </span>
        <button type="button" class="popup__link" data-test="sign-out" @click="signOut">
          Sign out
        </button>
      </span>
    </header>

    <p v-if="session.status === 'loading'" class="popup__muted" role="status">Loading…</p>
    <SignInForm
      v-else-if="session.status === 'signed-out'"
      :notice="signInNotice"
      @signed-in="onSignedIn"
    />

    <template v-else>
      <p v-if="preview.status === 'extracting'" class="popup__muted" role="status">Reading page…</p>
      <p v-else-if="preview.status === 'not-clippable'" class="popup__muted">
        This page can't be clipped.
      </p>
      <div v-else-if="preview.status === 'error'" class="popup__error" role="alert">
        <p>{{ preview.message }}</p>
        <button type="button" class="popup__retry" data-test="retry" @click="loadPreview">
          Retry
        </button>
      </div>
      <template v-else>
        <ClipPreview
          :page="preview.page"
          :saving="save.status === 'saving'"
          :saved="save.status === 'saved'"
          @save="saveClip"
        />
        <ClipStatus
          v-if="save.status === 'saved' || save.status === 'error'"
          :state="save"
          @retry="saveClip"
        />
      </template>
    </template>
  </main>
</template>

<style scoped lang="less">
@import '@/styles/variables.less';

.popup {
  width: @popup-width;
  max-height: @popup-max-height;
  padding: @space-4;
  overflow-y: auto;

  p {
    margin: 0;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: @space-3;
    margin-bottom: @space-3;
    font-size: @font-size-sm;
    color: @color-text-muted;
  }

  &__brand {
    flex-shrink: 0;
    font-weight: 600;
  }

  &__account {
    display: flex;
    min-width: 0;
    gap: @space-2;
  }

  &__email {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__link {
    flex-shrink: 0;
    padding: 0;
    font: inherit;
    color: @color-accent;
    background: none;
    border: 0;
    cursor: pointer;
  }

  &__muted {
    color: @color-text-muted;
  }

  &__error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: @space-3;
    color: @color-danger;
  }

  &__retry {
    flex-shrink: 0;
    padding: @space-1 @space-3;
    font: inherit;
    color: @color-text;
    background: @color-bg;
    border: 1px solid @color-border;
    border-radius: @radius;
    cursor: pointer;
  }
}
</style>
