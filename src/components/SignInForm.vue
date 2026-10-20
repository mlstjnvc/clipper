<script setup lang="ts">
import { ref } from 'vue'
import { signInErrorMessage } from '@/lib/errors'
import { sendMessage } from '@/lib/messages'
import { ensureApiAccess } from '@/lib/permissions'
import type { AuthUser } from '@/types/api'

defineProps<{ notice?: string | null }>()
const emit = defineEmits<{ signedIn: [user: AuthUser] }>()

const email = ref('')
const password = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

const submit = async () => {
  if (submitting.value) return
  submitting.value = true
  error.value = null

  try {
    // First await of the click: Firefox only prompts while still inside the user gesture.
    if (!(await ensureApiAccess())) {
      error.value = 'dlmnt-clipper needs access to dlmnt to sign you in.'
      return
    }

    const result = await sendMessage('auth:sign-in', {
      email: email.value.trim(),
      password: password.value,
    })
    if (result.ok) {
      password.value = ''
      emit('signedIn', result.user)
    } else {
      error.value = signInErrorMessage(result.error)
    }
  } catch {
    error.value = 'Something went wrong. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="sign-in" novalidate @submit.prevent="submit">
    <h2 class="sign-in__title">Sign in to dlmnt</h2>
    <p v-if="notice" class="sign-in__notice" data-test="notice">{{ notice }}</p>

    <label class="sign-in__field">
      <span>Email</span>
      <input
        v-model="email"
        type="email"
        name="email"
        autocomplete="username"
        required
        :disabled="submitting"
        data-test="email"
      />
    </label>
    <label class="sign-in__field">
      <span>Password</span>
      <input
        v-model="password"
        type="password"
        name="password"
        autocomplete="current-password"
        required
        :disabled="submitting"
        data-test="password"
      />
    </label>

    <p v-if="error" class="sign-in__error" role="alert" data-test="error">{{ error }}</p>

    <button
      type="submit"
      class="sign-in__submit"
      :disabled="submitting || !email.trim() || !password"
      data-test="submit"
    >
      {{ submitting ? 'Signing in…' : 'Sign in' }}
    </button>
  </form>
</template>

<style scoped lang="less">
@import '@/styles/variables.less';

.sign-in {
  display: flex;
  flex-direction: column;
  gap: @space-3;

  &__title {
    margin: 0;
    font-size: @font-size-lg;
    font-weight: 600;
  }

  &__notice,
  &__error {
    margin: 0;
  }

  &__notice {
    color: @color-text-muted;
  }

  &__error {
    color: @color-danger;
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: @space-1;
    font-size: @font-size-sm;
    color: @color-text-muted;

    input {
      padding: @space-2;
      font: inherit;
      font-size: @font-size-md;
      color: @color-text;
      border: 1px solid @color-border;
      border-radius: @radius;

      &:focus-visible {
        outline: 2px solid @color-accent;
        outline-offset: 1px;
      }
    }
  }

  &__submit {
    padding: @space-2 @space-4;
    font: inherit;
    font-weight: 600;
    color: #fff;
    background: @color-accent;
    border: 0;
    border-radius: @radius;
    cursor: pointer;

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }
  }
}
</style>
