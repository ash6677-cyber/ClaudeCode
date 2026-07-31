import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { DEFAULT_EDITOR_FONT_ID } from '@/lib/editor/fonts'

interface PreferencesState {
  editorFont: string
  typewriterMode: boolean
  dimInactiveParagraphs: boolean
  setEditorFont: (id: string) => void
  setTypewriterMode: (value: boolean) => void
  setDimInactiveParagraphs: (value: boolean) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      editorFont: DEFAULT_EDITOR_FONT_ID,
      typewriterMode: false,
      dimInactiveParagraphs: false,
      setEditorFont: (id) => set({ editorFont: id }),
      setTypewriterMode: (value) => set({ typewriterMode: value }),
      setDimInactiveParagraphs: (value) => set({ dimInactiveParagraphs: value }),
    }),
    { name: 'inkwell-preferences' },
  ),
)
