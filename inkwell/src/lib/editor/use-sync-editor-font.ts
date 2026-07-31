import { useEffect } from 'react'

import { getEditorFont } from '@/lib/editor/fonts'
import { usePreferencesStore } from '@/stores/preferences-store'

/** Keeps `--editor-font` on the document root in sync with the user's chosen prose
 * typeface, so every `.editor-prose` surface (manuscript, Codex entries, find/replace)
 * picks it up without each one needing its own wiring. */
export function useSyncEditorFont() {
  const editorFontId = usePreferencesStore((s) => s.editorFont)
  useEffect(() => {
    document.documentElement.style.setProperty('--editor-font', getEditorFont(editorFontId).cssFamily)
  }, [editorFontId])
}
