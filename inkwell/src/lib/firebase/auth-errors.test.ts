import { describe, expect, it } from 'vitest'

import { displayNameFromProfile, isDismissedByUser, readableAuthError } from './auth-errors'

const err = (code: string, customData?: Record<string, unknown>) => ({ code, customData })

describe('readableAuthError', () => {
  it('explains an unauthorised domain, the error a first deployment hits', () => {
    const message = readableAuthError(err('auth/unauthorized-domain'))
    expect(message).toContain('authorised domains')
    expect(message).toContain('Authentication → Settings')
  })

  it('explains a provider that was never enabled in the console', () => {
    const message = readableAuthError(err('auth/operation-not-allowed'))
    expect(message).toContain('Sign-in method')
  })

  it('names the email when one provider has already claimed it', () => {
    const message = readableAuthError(
      err('auth/account-exists-with-different-credential', { email: 'mara@example.com' }),
    )
    expect(message).toContain('mara@example.com')
  })

  it('still says something useful when the email is missing', () => {
    const message = readableAuthError(err('auth/account-exists-with-different-credential'))
    expect(message).toContain('different sign-in method')
    expect(message).not.toContain('undefined')
  })

  it('ignores a non-string email rather than interpolating it', () => {
    const message = readableAuthError(
      err('auth/account-exists-with-different-credential', { email: { nope: true } }),
    )
    expect(message).not.toContain('object')
    expect(message).not.toContain('undefined')
  })

  it('covers the everyday email/password failures', () => {
    expect(readableAuthError(err('auth/wrong-password'))).toContain('don’t match')
    expect(readableAuthError(err('auth/weak-password'))).toContain('6 characters')
    expect(readableAuthError(err('auth/email-already-in-use'))).toContain('already exists')
  })

  it('distinguishes a network failure from a generic one', () => {
    expect(readableAuthError(err('auth/network-request-failed'))).toContain('connection')
    expect(readableAuthError(err('auth/too-many-requests'))).toContain('Wait a few minutes')
  })

  it('falls back gracefully on anything unrecognised', () => {
    expect(readableAuthError(err('auth/some-future-code'))).toBe(
      'Something went wrong signing in. Please try again.',
    )
    expect(readableAuthError(undefined)).toContain('Something went wrong')
    expect(readableAuthError(new Error('plain'))).toContain('Something went wrong')
  })
})

describe('isDismissedByUser', () => {
  it('treats a closed or superseded popup as a decision, not a failure', () => {
    expect(isDismissedByUser(err('auth/popup-closed-by-user'))).toBe(true)
    expect(isDismissedByUser(err('auth/cancelled-popup-request'))).toBe(true)
  })

  it('does not swallow real failures', () => {
    expect(isDismissedByUser(err('auth/popup-blocked'))).toBe(false)
    expect(isDismissedByUser(err('auth/unauthorized-domain'))).toBe(false)
    expect(isDismissedByUser(undefined)).toBe(false)
  })
})

describe('displayNameFromProfile', () => {
  it('reads the nested name Apple sends on first authorisation only', () => {
    expect(displayNameFromProfile({ name: { firstName: 'Mara', lastName: 'Vance' } })).toBe(
      'Mara Vance',
    )
  })

  it('copes with Apple sending only one half of the name', () => {
    expect(displayNameFromProfile({ name: { firstName: 'Mara' } })).toBe('Mara')
    expect(displayNameFromProfile({ name: { lastName: 'Vance' } })).toBe('Vance')
  })

  it('reads the flat name Google and Facebook send', () => {
    expect(displayNameFromProfile({ name: 'Mara Vance' })).toBe('Mara Vance')
  })

  it('assembles a name from either provider’s split fields', () => {
    expect(displayNameFromProfile({ given_name: 'Mara', family_name: 'Vance' })).toBe('Mara Vance')
    expect(displayNameFromProfile({ first_name: 'Mara', last_name: 'Vance' })).toBe('Mara Vance')
  })

  it('prefers the full name over the split fields when both are present', () => {
    expect(displayNameFromProfile({ name: 'Mara V. Vance', given_name: 'Mara' })).toBe(
      'Mara V. Vance',
    )
  })

  it('returns null rather than a blank or junk name', () => {
    expect(displayNameFromProfile(null)).toBeNull()
    expect(displayNameFromProfile(undefined)).toBeNull()
    expect(displayNameFromProfile({})).toBeNull()
    expect(displayNameFromProfile('Mara')).toBeNull()
    expect(displayNameFromProfile({ name: '   ' })).toBeNull()
    expect(displayNameFromProfile({ name: { firstName: '  ', lastName: '' } })).toBeNull()
    expect(displayNameFromProfile({ name: { firstName: 42 } })).toBeNull()
  })
})
