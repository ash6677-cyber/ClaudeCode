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
  return (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    // The redirect flow's equivalents: backing out on the provider's own
    // consent screen rather than closing a popup.
    code === 'auth/user-cancelled' ||
    code === 'auth/redirect-cancelled-by-user'
  )
}

/**
 * Whether a failed popup should be retried as a full-page redirect.
 *
 * The first two mean "this browser would not open the window", not "the
 * sign-in was refused" — a blocker extension, an aggressive popup policy, or
 * an embedded webview with no popup support at all.
 *
 * `auth/internal-error` is here for a narrower and less obvious reason.
 * Before it can open a popup, the SDK loads `apis.google.com/js/api.js` and
 * stands up a hidden iframe to receive the result; if that script can't be
 * fetched the script tag's `onerror` surfaces as exactly this code, and the
 * writer gets "Something went wrong" for what is really a blocked host — a
 * corporate firewall, a filtering DNS resolver, a broad ad-blocking list.
 * Measured directly: on a network that can't reach `apis.google.com`, the
 * popup fails this way every time while the redirect flow, which needs no
 * iframe and no gapi, completes normally. A dead end that a single retry can
 * turn into a working sign-in is worth the retry, and this only ever runs
 * after a popup has already failed.
 *
 * Everything else is a real failure that a redirect would hit identically,
 * slower and with the page's state thrown away by the navigation.
 */
export function shouldFallBackToRedirect(err: unknown): boolean {
  const code = errorCode(err)
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/internal-error'
  )
}

/** Shown when nothing more specific can be said. */
const GENERIC_AUTH_ERROR = 'Something went wrong signing in. Please try again.'

export function readableAuthError(err: unknown): string {
  return describeAuthError(err) ?? GENERIC_AUTH_ERROR
}

/**
 * Like `readableAuthError`, but null for a code we can't name.
 *
 * This exists for the return leg of a redirect sign-in, where nobody is
 * waiting on an answer and the writer may simply have pressed Back on the
 * provider's page. Firebase reports an abandoned redirect as a bare timeout
 * or internal error — indistinguishable from a genuine hiccup — and greeting
 * someone who changed their mind with "Something went wrong signing in" is a
 * false alarm about a page they deliberately left. So on that path anything
 * we can actually name is worth saying, and anything we can't is worth
 * nothing: the writer is simply signed out, exactly as they were before.
 */
export function describeAuthError(err: unknown): string | null {
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
    case 'auth/user-cancelled':
    case 'auth/redirect-cancelled-by-user':
      return 'Sign-in was closed before finishing.'
    case 'auth/cancelled-popup-request':
      return 'Another sign-in window is already open.'
    case 'auth/popup-blocked':
    case 'auth/operation-not-supported-in-this-environment':
      return 'Your browser blocked the sign-in window. Allow popups for this site, then try again.'

    // The two that will greet a first deployment. Without naming them the
    // user is left guessing at their Firebase console.
    case 'auth/unauthorized-domain':
      return 'This site’s domain isn’t on the Firebase authorised domains list. Add it under Authentication → Settings → Authorized domains.'
    case 'auth/operation-not-allowed':
      return 'That sign-in method isn’t enabled for this Firebase project yet. Turn it on under Authentication → Sign-in method.'
    case 'auth/configuration-not-found':
    case 'auth/invalid-api-key':
      return 'This build’s Firebase settings don’t match a real project. Check the VITE_FIREBASE_* values it was built with.'

    // Both mean the browser threw away the state the sign-in was relying on:
    // `missing-initial-state` is what Safari and other third-party-storage
    // blockers return on the way back from a redirect, and
    // `web-storage-unsupported` is a private window with storage switched
    // off. Neither is retryable in the same tab, so say what to change.
    case 'auth/missing-or-invalid-nonce':
    case 'auth/missing-initial-state':
      return 'The sign-in didn’t survive the trip back to this page. This usually means the browser is blocking storage for this site — try a normal (non-private) window, or sign in with your email instead.'
    case 'auth/web-storage-unsupported':
      return 'This browser is blocking the storage sign-in needs. Enable cookies and site data for this site, or sign in with your email instead.'

    case 'auth/credential-already-in-use':
      return 'That account is already linked to a different INKWELL sign-in.'

    case 'auth/network-request-failed':
      return 'Couldn’t reach the sign-in service. Check your connection and try again.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes before trying again.'
    case 'auth/user-disabled':
      return 'That account has been disabled.'

    default:
      return null
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
