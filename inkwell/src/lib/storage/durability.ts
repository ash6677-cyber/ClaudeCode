import { isTauriRuntime } from '@/lib/db/tauri-bridge'

/**
 * Keeping a manuscript alive in a browser.
 *
 * A web app's IndexedDB is not permanent by default. Browsers evict it under
 * storage pressure, and iOS Safari deletes script-writable storage outright
 * after seven days without a visit — which for a novel means a fortnight away
 * from the desk can cost the lot. Nothing here is theoretical; it is the
 * single largest risk to the user's work in the browser build.
 *
 * Two defences, neither of which applies to the desktop app (its data is in
 * real files on disk):
 *
 *  - `navigator.storage.persist()` asks for storage exempt from eviction.
 *    Firefox prompts, Chromium grants it silently on engagement signals such
 *    as installation, and Safari does not implement it at all — hence the
 *    second defence.
 *  - Installing the app. A Home Screen web app on iOS is exempt from the
 *    seven-day rule, which makes "Add to Home Screen" a data-safety measure
 *    rather than a convenience.
 */

export type PersistState = 'unsupported' | 'persisted' | 'denied'

export async function requestPersistentStorage(): Promise<PersistState> {
  if (isTauriRuntime()) return 'persisted'
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return 'unsupported'
  try {
    if (await navigator.storage.persisted?.()) return 'persisted'
    return (await navigator.storage.persist()) ? 'persisted' : 'denied'
  } catch {
    return 'unsupported'
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    return { usage, quota }
  } catch {
    return null
  }
}

/** True when running as an installed app rather than a browser tab. */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false
  const standalone = (window.navigator as { standalone?: boolean }).standalone
  return window.matchMedia?.('(display-mode: standalone)').matches === true || standalone === true
}

/**
 * Safari is the browser that evicts on a timer *and* the one that won't let
 * us ask for an exemption, so it is the only place where being uninstalled is
 * genuinely dangerous rather than merely untidy.
 */
export function isEvictionProne(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const webkit = /iP(hone|ad|od)/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|Android/.test(ua))
  return webkit && !isInstalled()
}

const SW_PATH = 'sw.js'

/**
 * Registers the worker relative to the deployed base path, so a repository
 * rename or a move to another subdirectory cannot leave it pointing at a URL
 * that no longer exists.
 */
export function registerServiceWorker(): void {
  if (isTauriRuntime()) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) return

  const base = import.meta.env.BASE_URL || '/'
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${base}${SW_PATH}`, { scope: base })
      .then((registration) => {
        // An explicit update check on every load, because this scope has a
        // history: another app's worker owned it before INKWELL did, and a
        // phone from that era serves that app's dead menu until the
        // registration updates to this one's worker. register() alone leaves
        // that to the browser's own schedule; this makes the first visit the
        // one that heals.
        registration.update().catch(() => {})
      })
      .catch(() => {
        // Offline support is a bonus, never a requirement for the app to run.
      })
  })
}
