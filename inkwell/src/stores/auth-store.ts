import {
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { create } from 'zustand'

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

function readableAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''
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
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.'
    case 'auth/popup-closed-by-user':
      return 'Sign-in was closed before finishing.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Please allow popups for this site and try again.'
    default:
      return 'Something went wrong signing in. Please try again.'
  }
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

  signInWithGoogle: async () => {
    set({ error: null })
    try {
      const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
      set({ user: toAuthUser(credential.user), status: 'signed-in' })
    } catch (err) {
      set({ error: readableAuthError(err) })
      throw err
    }
  },

  signInWithFacebook: async () => {
    set({ error: null })
    try {
      const credential = await signInWithPopup(firebaseAuth, new FacebookAuthProvider())
      set({ user: toAuthUser(credential.user), status: 'signed-in' })
    } catch (err) {
      set({ error: readableAuthError(err) })
      throw err
    }
  },

  signInWithApple: async () => {
    set({ error: null })
    try {
      const provider = new OAuthProvider('apple.com')
      provider.addScope('email')
      provider.addScope('name')
      const credential = await signInWithPopup(firebaseAuth, provider)
      set({ user: toAuthUser(credential.user), status: 'signed-in' })
    } catch (err) {
      set({ error: readableAuthError(err) })
      throw err
    }
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
