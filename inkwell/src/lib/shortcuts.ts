/**
 * The single source of truth for keyboard shortcuts.
 *
 * Both the handlers that implement a shortcut and the reference table in
 * Settings read from this list, so the documentation cannot drift away from
 * what the app actually does.
 *
 * Combos are written with `Mod` for "Cmd on macOS, Ctrl everywhere else",
 * plus optional `Shift` / `Alt`, ending in a key name matching
 * `KeyboardEvent.key` (single letters are compared case-insensitively).
 */

export type ShortcutId =
  | 'command-palette'
  | 'toggle-sidebar'
  | 'settings'
  | 'new-project'
  | 'toggle-focus-mode'
  | 'find-in-scene'
  | 'search-manuscript'
  | 'find-next'
  | 'find-previous'
  | 'close-overlay'
  | 'reader-next-page'
  | 'reader-previous-page'
  | 'chat-send'
  | 'chat-newline'
  | 'import-library'
  | 'export-library'
  | 'quit'

export type ShortcutGroup = 'Anywhere' | 'Manuscript' | 'Reader' | 'Character chat'

export interface ShortcutDef {
  id: ShortcutId
  combo: string
  label: string
  group: ShortcutGroup
  /** Only wired up in the packaged desktop app. */
  desktopOnly?: boolean
  /** Shown beneath the label when the shortcut needs a caveat. */
  note?: string
}

export const SHORTCUTS: ShortcutDef[] = [
  { id: 'command-palette', combo: 'Mod+K', label: 'Open the command palette', group: 'Anywhere' },
  { id: 'toggle-sidebar', combo: 'Mod+B', label: 'Collapse or expand the sidebar', group: 'Anywhere' },
  { id: 'settings', combo: 'Mod+,', label: 'Open Settings', group: 'Anywhere' },
  {
    id: 'new-project',
    combo: 'Mod+N',
    label: 'Start a new project',
    group: 'Anywhere',
    desktopOnly: true,
    note: 'Browsers reserve this combination for a new window.',
  },
  {
    id: 'import-library',
    combo: 'Mod+I',
    label: 'Import a library file',
    group: 'Anywhere',
    desktopOnly: true,
    note: 'In the browser, use Settings → Data.',
  },
  {
    id: 'export-library',
    combo: 'Mod+Shift+E',
    label: 'Export your whole library',
    group: 'Anywhere',
    desktopOnly: true,
    note: 'In the browser, use Settings → Data.',
  },
  { id: 'quit', combo: 'Mod+Q', label: 'Save and quit', group: 'Anywhere', desktopOnly: true },

  { id: 'toggle-focus-mode', combo: 'Mod+.', label: 'Toggle focus mode', group: 'Manuscript' },
  { id: 'find-in-scene', combo: 'Mod+F', label: 'Find in this scene', group: 'Manuscript' },
  {
    id: 'search-manuscript',
    combo: 'Mod+Shift+F',
    label: 'Search the whole manuscript',
    group: 'Manuscript',
  },
  { id: 'find-next', combo: 'Enter', label: 'Jump to the next match', group: 'Manuscript' },
  {
    id: 'find-previous',
    combo: 'Shift+Enter',
    label: 'Jump to the previous match',
    group: 'Manuscript',
  },
  { id: 'close-overlay', combo: 'Escape', label: 'Close the find bar', group: 'Manuscript' },

  {
    id: 'reader-next-page',
    combo: 'ArrowRight',
    label: 'Turn to the next page',
    group: 'Reader',
    note: 'Space and Page Down do the same thing.',
  },
  {
    id: 'reader-previous-page',
    combo: 'ArrowLeft',
    label: 'Turn back a page',
    group: 'Reader',
    note: 'Page Up does the same thing.',
  },

  { id: 'chat-send', combo: 'Enter', label: 'Send the message', group: 'Character chat' },
  {
    id: 'chat-newline',
    combo: 'Shift+Enter',
    label: 'Start a new line instead of sending',
    group: 'Character chat',
  },
]

const BY_ID = new Map(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]))

export function shortcut(id: ShortcutId): ShortcutDef {
  const found = BY_ID.get(id)
  if (!found) throw new Error(`Unknown shortcut: ${id}`)
  return found
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  'Anywhere',
  'Manuscript',
  'Reader',
  'Character chat',
]

/** Single letters compare case-insensitively; everything else is a `key` name. */
function normalizeKey(key: string): string {
  return key === ' ' ? 'space' : key.toLowerCase()
}

export function matchesCombo(event: KeyboardEvent, combo: string): boolean {
  const parts = combo.split('+')
  const key = parts[parts.length - 1]

  // Every modifier is checked in both directions: Mod+F must not fire when
  // Shift is also down, or it would swallow Mod+Shift+F.
  const wantsMod = parts.includes('Mod')
  const wantsShift = parts.includes('Shift')
  const wantsAlt = parts.includes('Alt')

  if ((event.metaKey || event.ctrlKey) !== wantsMod) return false
  if (event.shiftKey !== wantsShift) return false
  if (event.altKey !== wantsAlt) return false

  return normalizeKey(event.key) === normalizeKey(key)
}

export function matchesShortcut(event: KeyboardEvent, id: ShortcutId): boolean {
  return matchesCombo(event, shortcut(id).combo)
}

const KEY_LABELS: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Enter: '↵',
  Escape: 'Esc',
  Space: 'Space',
  ',': ',',
  '.': '.',
}

export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent)
}

/** Splits a combo into the individual keycaps to render, in press order. */
export function comboKeys(combo: string, apple: boolean): string[] {
  return combo.split('+').map((part) => {
    if (part === 'Mod') return apple ? '⌘' : 'Ctrl'
    if (part === 'Shift') return apple ? '⇧' : 'Shift'
    if (part === 'Alt') return apple ? '⌥' : 'Alt'
    return KEY_LABELS[part] ?? (part.length === 1 ? part.toUpperCase() : part)
  })
}
