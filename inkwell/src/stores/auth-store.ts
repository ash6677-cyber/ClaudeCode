import {
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type AuthProvider,
  type User,
  type UserCredential,
} from 'firebase/auth'
import { create } from 'zustand'

import {
  displayNameFromProfile,
  isDismissedByUser,
  readableAuthError,
} from '@/lib/firebase/auth-errors'
import { firebaseAuth } from '@/lib/firebase/config'

export interface AuthUser {
  uid: string
  email: string | null
  authorName: string | null
  photoURL: string | null
}

type AuthStatus = 'loading' | 'signed-out' | 'signed-in'

interface AuthState {
  user: AuthUser | null
  status: AuthStatus
  error: string | null

  init: () => () => void
  signUpWithEmail: (email: string, password: string, authorName: string) => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  /** Shared popup flow; the three below just pick the provider. */
  signInWithProvider: (provider: AuthProvider) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithFacebook: () => Promise<void>
  signInWithApple: () => Promise<void>
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',
  error: null,

  init: () => {
    return onAuthStateChanged(firebaseAuth, (user) => {
      set({ user: user ? toAuthUser(user) : null, status: user ? 'signed-in' : 'signed-out' })
    })
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
    try {
      const result = await signInWithPopup(firebaseAuth, provider)
      const user = await completeOAuthSignIn(result)
      set({ user: toAuthUser(user), status: 'signed-in' })
    } catch (err) {
      // Closing the popup, or clicking a second provider while one is open,
      // is a change of mind rather than a failure — leave the dialog as it
      // was instead of accusing the writer of an error.
      if (isDismissedByUser(err)) return
      set({ error: readableAuthError(err) })
      throw err
    }
  },

  signInWithGoogle: () => get().signInWithProvider(new GoogleAuthProvider()),

  signInWithFacebook: () => get().signInWithProvider(new FacebookAuthProvider()),

  signInWithApple: () => {
    const provider = new OAuthProvider('apple.com')
    provider.addScope('email')
    provider.addScope('name')
    return get().signInWithProvider(provider)
  },

  signOut: async () => {
    await firebaseSignOut(firebaseAuth)
    set({ user: null, status: 'signed-out' })
  },

  updateAuthorName: async (authorName) => {
    const current = firebaseAuth.currentUser
    if (!current) throw new Error('Not signed in')
    await updateProfile(current, { displayName: authorName.trim() })
    set({ user: get().user ? { ...get().user!, authorName: authorName.trim() } : null })
  },

  clearError: () => set({ error: null }),
}))
