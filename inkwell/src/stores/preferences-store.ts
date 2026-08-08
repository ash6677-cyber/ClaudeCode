import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { DEFAULT_EDITOR_FONT_ID } from '@/lib/editor/fonts'

interface PreferencesState {
  editorFont: string
  typewriterMode: boolean
  dimInactiveParagraphs: boolean
  /** When the whole library was last exported to a file, or null if never. */
  lastBackupAt: number | null
  /** Epoch ms until which the backup reminder stays hidden. */
  backupSnoozedUntil: number
  /** The format the last manuscript export used. The next one starts there. */
  lastExportFormat: string | null
  /**
   * Whether the sample book has had its one chance to exist — set when it
   * is seeded, and equally when a library proves it never needed one.
   * Deleting the sample must never resurrect it.
   */
  sampleBookOffered: boolean
  setEditorFont: (id: string) => void
  setTypewriterMode: (value: boolean) => void
  setDimInactiveParagraphs: (value: boolean) => void
  markBackedUp: () => void
  rememberExportFormat: (format: string) => void
  snoozeBackupReminder: (days: number) => void
  markSampleBookOffered: () => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      editorFont: DEFAULT_EDITOR_FONT_ID,
      typewriterMode: false,
      dimInactiveParagraphs: false,
      lastBackupAt: null,
      backupSnoozedUntil: 0,
      lastExportFormat: null,
      sampleBookOffered: false,
      setEditorFont: (id) => set({ editorFont: id }),
      setTypewriterMode: (value) => set({ typewriterMode: value }),
      setDimInactiveParagraphs: (value) => set({ dimInactiveParagraphs: value }),
      markBackedUp: () => set({ lastBackupAt: Date.now(), backupSnoozedUntil: 0 }),
      rememberExportFormat: (format) => set({ lastExportFormat: format }),
      snoozeBackupReminder: (days) =>
        set({ backupSnoozedUntil: Date.now() + days * 24 * 60 * 60 * 1000 }),
      markSampleBookOffered: () => set({ sampleBookOffered: true }),
    }),
    { name: 'inkwell-preferences' },
  ),
)
