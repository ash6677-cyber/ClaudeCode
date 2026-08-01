import { type FirebaseApp, getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  type Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

import { isTauriRuntime } from '@/lib/db/tauri-bridge'

/**
 * Real projects set these via `.env.local` (see `.env.example`). With none
 * set, we fall back to a `demo-` project id talking only to the local
 * emulator suite — the values are never sent anywhere real, so placeholders
 * are fine. `demo-` is a reserved Firebase prefix the emulator recognizes
 * as "never a real project," which is what lets email/password auth and
 * Firestore sync be built and tested end-to-end without anyone's real
 * Firebase credentials.
 */
const hasRealConfig = Boolean(import.meta.env.VITE_FIREBASE_API_KEY)

const firebaseConfig = hasRealConfig
  ? {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }
  : {
      apiKey: 'demo-inkwell-key',
      authDomain: 'demo-inkwell.firebaseapp.com',
      projectId: 'demo-inkwell',
      storageBucket: 'demo-inkwell.appspot.com',
      messagingSenderId: '0',
      appId: 'demo-inkwell-app',
    }

let app: FirebaseApp
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig)
} else {
  app = getApps()[0]
}

export const firebaseAuth = getAuth(app)

/**
 * An IndexedDB-backed cache means edits made while offline are queued and
 * replayed automatically on reconnect, and a cold start can read the last
 * known library without waiting on the network. It can legitimately fail —
 * private-browsing modes and locked-down webviews both block the storage it
 * needs — so fall back to the in-memory cache rather than leaving the app
 * with no Firestore at all.
 *
 * `experimentalForceLongPolling` in the desktop shell is not a guess: with
 * Firestore's default streaming transport, sync in the packaged Tauri app
 * hung on "Syncing…" forever and never wrote a single document, while
 * authentication (plain HTTPS) worked fine. The WebChannel stream doesn't
 * complete inside the webview, and the SDK's auto-detection doesn't fail
 * over. Long-polling is slightly chattier but actually works there.
 */
function createFirestore(): Firestore {
  const settings = {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ...(isTauriRuntime() ? { experimentalForceLongPolling: true } : {}),
  }
  try {
    return initializeFirestore(app, settings)
  } catch {
    return getFirestore(app)
  }
}

export const firestore = createFirestore()

/**
 * Whether cloud accounts and sync are actually reachable.
 *
 * A production build with no Firebase project configured has nowhere to sign
 * in to: the emulator fallback points at 127.0.0.1, which on a deployed site
 * would mean the *visitor's* own machine. Rather than offer a sign-in button
 * that hangs against an emulator nobody is running, the cloud features
 * declare themselves unavailable and the app stays what it already is
 * without them — fully local-first.
 */
export const cloudEnabled = hasRealConfig || import.meta.env.DEV

/**
 * Use the local emulator suite whenever there's no real project configured
 * (dev by default) or when explicitly requested — never in a production
 * build, and never when pointed at a real project.
 */
const useEmulator =
  import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' || (!hasRealConfig && import.meta.env.DEV)

let emulatorsConnected = false
export function connectToEmulatorsIfConfigured() {
  if (!useEmulator || emulatorsConnected) return
  emulatorsConnected = true
  connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
}

connectToEmulatorsIfConfigured()
