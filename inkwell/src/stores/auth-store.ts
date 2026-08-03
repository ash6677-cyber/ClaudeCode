import {
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  getAdditionalUserInfo,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile,
  type AuthProvider,
  type User,
  type UserCredential,
} from 'firebase/auth'
import { create } from 'zustand'

import { isTauriRuntime } from '@/lib/db/tauri-bridge'
import {
  describeAuthError,
  displayNameFromProfile,
  isDismissedByUser,
  readableAuthError,
  shouldFallBackToRedirect,
} from '@/lib/firebase/auth-errors'
import { type AuthProviderId } from '@/lib/firebase/auth-providers'
import { firebaseAuth } from '@/lib/firebase/config'
import { isInstalled } from '@/lib/storage/durability'

export interface AuthUser {
  uid: string
  email: string | null
  authorName: string | null
  photoURL: string | null
}

type AuthStatus = 'loading' | 'signed-out' | 'signed-in'

/**
 * How a social sign-in attempt ended.
 *
 * Three outcomes, not two, because "cancelled" is neither success nor
 * failure. Collapsing it into either one is what made closing the Google
 * popup announce "Signed in" and dismiss the dialog: the store swallowed the
 * cancellation and returned normally, and the caller had no way left to tell
 * that apart from an actual sign-in.
 *
 * `redirecting` means the browser is about to navigate away to the provider;
 * the caller must not close the dialog or claim anything, because the answer
 * arrives on the next page load via `getRedirectResult`.
 */
export type SignInOutcome = 'signed-in' | 'dismissed' | 'redirecting'

interface AuthState {
  user: AuthUser | null
  status: AuthStatus
  error: string | null

  init: () => () => void
  signUpWithEmail: (email: string, password: string, authorName: string) => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  /** Shared popup/redirect flow; `signInWith` just picks the provider. */
  signInWithProvider: (provider: AuthProvider) => Promise<SignInOutcome>
  signInWith: (id: AuthProviderId) => Promise<SignInOutcome>
  /** Completes a sign-in that finished by redirect rather than in a popup. */
  consumeRedirectResult: () => Promise<void>
  signOut: () => Promise<void>
  updateAuthorName: (authorName: string) => Promise<void>
  clearError: () => void
}

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    authorName: user.displayName,
    photoURL: user.photoURL,
  }
}

/**
 * Finishes an OAuth sign-in, rescuing the display name if the provider only
 * offers it once.
 *
 * Apple returns the user's name **solely on the first authorisation** and
 * Firebase does not write it onto the account, so unless it is captured here
 * it is lost permanently and that writer's author name stays blank forever.
 * Google and Facebook are more forgiving, but the same path costs nothing and
 * covers the case where `displayName` comes back empty for any of them.
 */
async function completeOAuthSignIn(result: UserCredential): Promise<User> {
  const user = result.user
  if (user.displayName?.trim()) return user

  const name = displayNameFromProfile(getAdditionalUserInfo(result)?.profile)
  if (!name) return user

  // A failure here must not fail the sign-in itself — the account is already
  // valid, it just has no name on it, which the writer can still set by hand.
  try {
    await updateProfile(user, { displayName: name })
  } catch {
    return user
  }
  return user
}

function createProvider(id: AuthProviderId): AuthProvider {
  switch (id) {
    case 'google':
      return new GoogleAuthProvider()
    case 'facebook':
      return new FacebookAuthProvider()
    case 'apple': {
      const provider = new OAuthProvider('apple.com')
      provider.addScope('email')
      provider.addScope('name')
      return provider
    }
  }
}

/**
 * Whether to skip the popup entirely and go straight to a full-page redirect.
 *
 * An installed web app is the case that matters. On iOS a Home Screen app
 * runs in its own window with no browser chrome, and `window.open` hands the
 * URL to Safari as a separate app rather than opening a child window — so
 * there is no opener for the provider to post its result back to, and
 * `signInWithPopup` never settles. The spinner spins until the writer gives
 * up. Since INKWELL now actively asks people to install it (a Home Screen app
 * is exempt from Safari's seven-day storage eviction), that is not an edge
 * case, it is the recommended way to run the app.
 *
 * Redirect has no second window and so nothing to lose the handle to.
 */
function prefersRedirectSignIn(): boolean {
  // The desktop shell can't do either flow — its `tauri://` origin can't be
  // added to Firebase's authorized domains — and its buttons are hidden. Left
  // explicit so a future deep-link flow has an obvious place to hook in.
  if (isTauriRuntime()) return false
  return isInstalled()
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',
  error: null,

  init: () => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      set({ user: user ? toAuthUser(user) : null, status: user ? 'signed-in' : 'signed-out' })
    })
    // A redirect sign-in lands back here on a fresh page load, and its result
    // is delivered exactly once, to whoever asks first. Nobody was asking, so
    // every redirect sign-in silently dropped both the provider profile (and
    // with it Apple's one-and-only chance to supply a name) and any error the
    // handshake produced.
    void get().consumeRedirectResult()
    return unsubscribe
  },

  signUpWithEmail: async (email, password, authorName) => {
    set({ error: null })
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password)
      if (authorName.trim()) {
        await updateProfile(credential.user, { displayName: authorName.trim() })
      }
      set({ user: toAuthUser(credential.user), status: 'signed-in' })
    } catch (err) {
      set({ error: readableAuthError(err) })
      throw err
    }
  },

  signInWithEmail: async (email, password) => {
    set({ error: null })
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password)
      set({ user: toAuthUser(credential.user), status: 'signed-in' })
    } catch (err) {
      set({ error: readableAuthError(err) })
      throw err
    }
  },

  signInWithProvider: async (provider) => {
    set({ error: null })

    const redirect = async (): Promise<SignInOutcome> => {
      try {
        await signInWithRedirect(firebaseAuth, provider)
        // Normally unreachable: the call navigates the page away. It returns
        // only if the navigation is refused, in which case there is nothing
        // more to wait for and the caller should simply stop.
        return 'redirecting'
      } catch (err) {
        set({ error: readableAuthError(err) })
        throw err
      }
    }

    if (prefersRedirectSignIn()) return redirect()

    try {
      const result = await signInWithPopup(firebaseAuth, provider)
      const user = await completeOAuthSignIn(result)
      set({ user: toAuthUser(user), status: 'signed-in' })
      return 'signed-in'
    } catch (err) {
      // Closing the popup, or clicking a second provider while one is open,
      // is a change of mind rather than a failure — leave the dialog as it
      // was instead of accusing the writer of an error.
      if (isDismissedByUser(err)) return 'dismissed'
      // The window never opened, so there is nothing the writer did wrong and
      // nothing to retry identically. Redirect needs no second window.
      if (shouldFallBackToRedirect(err)) return redirect()
      set({ error: readableAuthError(err) })
      throw err
    }
  },

  signInWith: (id) => get().signInWithProvider(createProvider(id)),

  consumeRedirectResult: async () => {
    try {
      const result = await getRedirectResult(firebaseAuth)
      // Null on an ordinary page load, which is almost every load.
      if (!result) return
      const user = await completeOAuthSignIn(result)
      set({ user: toAuthUser(user), status: 'signed-in' })
    } catch (err) {
      if (isDismissedByUser(err)) return
      // Nothing awaits this, so a failure worth reporting has to be left
      // somewhere visible rather than rethrown into a dangling promise. The
      // account screen renders `error` when signed out, which is where the
      // redirect lands.
      //
      // Deliberately `describeAuthError`, not `readableAuthError`: pressing
      // Back on the provider's page comes back as a bare timeout, and telling
      // someone who changed their mind that something went wrong is a false
      // alarm about a page they chose to leave. Only a named, actionable
      // problem is worth surfacing here.
      const message = describeAuthError(err)
      if (message) set({ error: message })
    }
  },

  signOut: async () => {
    await firebaseSignOut(firebaseAuth)
    set({ user: null, status: 'signed-out', error: null })
  },

  updateAuthorName: async (authorName) => {
    const current = firebaseAuth.currentUser
    if (!current) throw new Error('Not signed in')
    await updateProfile(current, { displayName: authorName.trim() })
    set({ user: get().user ? { ...get().user!, authorName: authorName.trim() } : null })
  },

  clearError: () => set({ error: null }),
}))
