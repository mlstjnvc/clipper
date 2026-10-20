import type { ApiError } from '@/types/api'

const NETWORK = "Can't reach dlmnt. Check your connection and try again."

/** What the sign-in form shows for a failed sign-in. */
export const signInErrorMessage = (error: ApiError): string => {
  switch (error.kind) {
    case 'validation':
      return error.fields?.email?.[0] ?? error.message ?? 'Invalid email or password.'
    case 'throttled':
      return 'Too many attempts. Try again in a minute.'
    case 'network':
      return NETWORK
    default:
      return 'Sign-in is currently unavailable. Please try again later.'
  }
}

/** What the popup shows for a failed save. `unauthorized` sends the user to sign-in instead. */
export const saveErrorMessage = (error: ApiError): string => {
  switch (error.kind) {
    case 'too-large':
      return 'This page is too large to save.'
    case 'validation':
      return `dlmnt couldn't accept this page${error.message ? `: ${error.message}` : '.'}`
    case 'throttled':
      return 'Too many saves. Try again in a minute.'
    case 'network':
      return NETWORK
    case 'forbidden':
      return "This sign-in can't save pages. Sign out and sign in again."
    case 'unauthorized':
      return 'Your sign-in has expired. Please sign in again.'
    default:
      return 'dlmnt had a problem saving this page. Please try again.'
  }
}
