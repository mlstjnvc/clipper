import { describe, expect, it } from 'vitest'
import { saveErrorMessage, signInErrorMessage } from '@/lib/errors'
import type { ApiError, ApiErrorKind } from '@/types/api'

const error = (kind: ApiErrorKind, extra: Partial<ApiError> = {}): ApiError => ({
  kind,
  status: null,
  message: null,
  ...extra,
})

describe('signInErrorMessage', () => {
  it('prefers the field error, then the message, then a default', () => {
    expect(signInErrorMessage(error('validation', { fields: { email: ['Bad email.'] } }))).toBe(
      'Bad email.',
    )
    expect(signInErrorMessage(error('validation', { message: 'Nope.' }))).toBe('Nope.')
    expect(signInErrorMessage(error('validation'))).toBe('Invalid email or password.')
  })
})

describe('saveErrorMessage', () => {
  it.each([
    ['too-large', 'too large'],
    ['throttled', 'Too many saves'],
    ['network', "Can't reach dlmnt"],
    ['forbidden', "can't save pages"],
    ['unauthorized', 'expired'],
    ['server', 'had a problem'],
  ] as const)('%s → mentions "%s"', (kind, text) => {
    expect(saveErrorMessage(error(kind))).toContain(text)
  })

  it('includes the server message for validation errors', () => {
    expect(saveErrorMessage(error('validation', { message: 'The url is invalid.' }))).toBe(
      "dlmnt couldn't accept this page: The url is invalid.",
    )
    expect(saveErrorMessage(error('validation'))).toBe("dlmnt couldn't accept this page.")
  })
})
