import { describe, expect, it } from 'vitest'

import {
  describeAuthError,
  displayNameFromProfile,
  isDismissedByUser,
  readableAuthError,
  shouldFallBackToRedirect,
} from './auth-errors'

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

describe('isDismissedByUser — redirect flow', () => {
  it('counts backing out of the provider’s own consent screen', () => {
    // The redirect flow's equivalents of closing a popup. Missing these
    // meant a cancelled redirect surfaced as a red error on return.
    expect(isDismissedByUser(err('auth/user-cancelled'))).toBe(true)
    expect(isDismissedByUser(err('auth/redirect-cancelled-by-user'))).toBe(true)
  })

  it('still treats a genuine failure as a failure', () => {
    expect(isDismissedByUser(err('auth/popup-blocked'))).toBe(false)
    expect(isDismissedByUser(err('auth/unauthorized-domain'))).toBe(false)
  })
})

describe('shouldFallBackToRedirect', () => {
  it('retries as a redirect when the window never opened', () => {
    expect(shouldFallBackToRedirect(err('auth/popup-blocked'))).toBe(true)
    expect(shouldFallBackToRedirect(err('auth/operation-not-supported-in-this-environment'))).toBe(
      true,
    )
  })

  it('retries when the popup machinery itself could not load', () => {
    // A network that blocks apis.google.com fails the SDK's iframe bootstrap
    // and reports it as a bare internal error. Redirect needs neither.
    expect(shouldFallBackToRedirect(err('auth/internal-error'))).toBe(true)
  })

  it('does not navigate away for failures a redirect cannot fix', () => {
    // Redirect throws away the page's state, so it must not be attempted for
    // an error that would simply recur — an unauthorised domain or a
    // provider left disabled fails identically either way.
    for (const code of [
      'auth/unauthorized-domain',
      'auth/operation-not-allowed',
      'auth/network-request-failed',
      'auth/popup-closed-by-user',
      'auth/account-exists-with-different-credential',
    ]) {
      expect(shouldFallBackToRedirect(err(code))).toBe(false)
    }
  })

  it('does not fire on a non-Firebase error', () => {
    expect(shouldFallBackToRedirect(new Error('boom'))).toBe(false)
    expect(shouldFallBackToRedirect(undefined)).toBe(false)
  })
})

describe('readableAuthError — the codes a real deployment adds', () => {
  it('names a build whose Firebase settings point nowhere real', () => {
    for (const code of ['auth/configuration-not-found', 'auth/invalid-api-key']) {
      expect(readableAuthError(err(code))).toContain('VITE_FIREBASE_')
    }
  })

  it('explains the Safari redirect that loses its own state', () => {
    // `auth/missing-initial-state` is what a third-party-storage blocker
    // returns on the way back from a redirect. "Something went wrong" here
    // is the difference between a fixable problem and an unusable app.
    const message = readableAuthError(err('auth/missing-initial-state'))
    expect(message).toContain('blocking storage')
    expect(message).toContain('email')
  })

  it('explains storage being switched off entirely', () => {
    expect(readableAuthError(err('auth/web-storage-unsupported'))).toContain('cookies')
  })

  it('treats a blocked window and an unsupported one the same way', () => {
    expect(readableAuthError(err('auth/operation-not-supported-in-this-environment'))).toBe(
      readableAuthError(err('auth/popup-blocked')),
    )
  })

  it('does not blame the writer for cancelling a redirect', () => {
    expect(readableAuthError(err('auth/user-cancelled'))).toBe(
      readableAuthError(err('auth/popup-closed-by-user')),
    )
  })
})

describe('describeAuthError', () => {
  it('says nothing for a code it cannot name', () => {
    // The return leg of a redirect nobody completed: Firebase reports an
    // abandoned handshake as a bare timeout or internal error, and a false
    // alarm about a page the writer chose to leave is worse than silence.
    expect(describeAuthError(err('auth/timeout'))).toBeNull()
    expect(describeAuthError(err('auth/internal-error'))).toBeNull()
    expect(describeAuthError(err('auth/some-future-code'))).toBeNull()
    expect(describeAuthError(undefined)).toBeNull()
  })

  it('still names everything actionable', () => {
    for (const code of [
      'auth/account-exists-with-different-credential',
      'auth/unauthorized-domain',
      'auth/operation-not-allowed',
      'auth/missing-initial-state',
      'auth/user-disabled',
    ]) {
      expect(describeAuthError(err(code))).toBe(readableAuthError(err(code)))
    }
  })

  it('is what readableAuthError falls back from', () => {
    expect(readableAuthError(err('auth/timeout'))).toBe(
      'Something went wrong signing in. Please try again.',
    )
  })
})
