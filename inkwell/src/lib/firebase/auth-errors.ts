/**
 * Auth error and profile handling, kept free of Firebase imports so it can be
 * unit-tested without initialising an app or reaching a network.
 *
 * These paths exist because the Firebase emulator, which is what the sign-in
 * flow was built against, never produces most of them. Real Google, Apple and
 * Facebook sign-in fails in ways the emulator simply cannot reproduce — an
 * unauthorised domain, a provider left disabled in the console, one email
 * already claimed by a different provider — and each of those arrives as an
 * opaque error code that would otherwise surface as "Something went wrong".
 */

function errorCode(err: unknown): string {
  return (err as { code?: string })?.code ?? ''
}

function errorEmail(err: unknown): string | null {
  const data = (err as { customData?: { email?: unknown } })?.customData
  return typeof data?.email === 'string' && data.email.length > 0 ? data.email : null
}

/**
 * Closing the popup, or clicking a second provider while one is already open,
 * is a decision — not a failure. Surfacing it as an error would mean every
 * changed mind produces a red toast.
 */
export function isDismissedByUser(err: unknown): boolean {
  const code = errorCode(err)
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'
}

export function readableAuthError(err: unknown): string {
  const code = errorCode(err)
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account already exists with that email.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password don’t match an account.'
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.'
    case 'auth/invalid-email':
      return 'That doesn’t look like a valid email address.'

    case 'auth/account-exists-with-different-credential': {
      // Hitting this means the email is already registered under another
      // provider. Naming the address is the difference between a dead end and
      // an instruction, and it's the most common real-provider collision:
      // sign up with Google, come back later and click Facebook.
      const email = errorEmail(err)
      return email
        ? `${email} is already registered using a different sign-in method. Sign in the way you did the first time, then link the other provider from Settings.`
        : 'That email is already registered using a different sign-in method. Sign in the way you did the first time.'
    }

    case 'auth/popup-closed-by-user':
      return 'Sign-in was closed before finishing.'
    case 'auth/cancelled-popup-request':
      return 'Another sign-in window is already open.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups for this site, then try again.'

    // The two that will greet a first deployment. Without naming them the
    // user is left guessing at their Firebase console.
    case 'auth/unauthorized-domain':
      return 'This site’s domain isn’t on the Firebase authorised domains list. Add it under Authentication → Settings → Authorized domains.'
    case 'auth/operation-not-allowed':
      return 'That sign-in method isn’t enabled for this Firebase project yet. Turn it on under Authentication → Sign-in method.'

    case 'auth/network-request-failed':
      return 'Couldn’t reach the sign-in service. Check your connection and try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes before trying again.'
    case 'auth/user-disabled':
      return 'That account has been disabled.'

    default:
      return 'Something went wrong signing in. Please try again.'
  }
}

/**
 * Pulls a display name out of an OAuth provider's raw profile.
 *
 * Each provider shapes this differently, and Apple is the one that matters:
 * it returns the user's name **only on the very first authorisation**, in a
 * nested `name` object, and never again. Firebase does not copy it onto the
 * account automatically, so a name not captured at that moment is gone for
 * good — leaving the author name permanently blank for every Apple user.
 */
export function displayNameFromProfile(profile: unknown): string | null {
  if (!profile || typeof profile !== 'object') return null
  const record = profile as Record<string, unknown>

  // Apple: { name: { firstName, lastName } }
  const nested = record.name
  if (nested && typeof nested === 'object') {
    const parts = nested as Record<string, unknown>
    const joined = [parts.firstName, parts.lastName]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim()
    if (joined) return joined
  }

  // Google and Facebook: a flat `name`.
  if (typeof nested === 'string' && nested.trim()) return nested.trim()

  // Fall back to assembling one from the parts each provider spells its own way.
  for (const [first, last] of [
    ['given_name', 'family_name'],
    ['first_name', 'last_name'],
  ]) {
    const joined = [record[first], record[last]]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim()
    if (joined) return joined
  }

  return null
}
