import { create } from 'zustand'

import { importLibraryFromFile } from '@/lib/db/tauri-db'

interface ImportState {
  pendingPath: string | null
  importing: boolean
  error: string | null
  setPendingPath: (path: string | null) => void
  confirm: () => Promise<void>
}

/**
 * Shared across the Data Settings "Import library…" button, the native File
 * menu, and drag-and-drop-a-file-onto-the-window — all three just need to set
 * `pendingPath` and the one globally-mounted confirm dialog handles the rest.
 */
export const useImportStore = create<ImportState>((set, get) => ({
  pendingPath: null,
  importing: false,
  error: null,
  setPendingPath: (path) => set({ pendingPath: path, error: null }),
  confirm: async () => {
    const path = get().pendingPath
    if (!path) return
    set({ importing: true, error: null })
    try {
      await importLibraryFromFile(path)
      window.location.reload()
    } catch {
      set({
        importing: false,
        error: 'That file could not be read as an INKWELL library.',
      })
    }
  },
}))
