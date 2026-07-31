import { create } from 'zustand'

interface UiState {
  sidebarCollapsed: boolean
  focusMode: boolean
  commandPaletteOpen: boolean
  manuscriptSearchOpen: boolean
  mobileNavOpen: boolean
  /** Bumped by the native "New Project" menu item so the Projects page can react from any route. */
  newProjectRequestNonce: number
  toggleSidebar: () => void
  setFocusMode: (value: boolean) => void
  setCommandPaletteOpen: (value: boolean) => void
  setManuscriptSearchOpen: (value: boolean) => void
  setMobileNavOpen: (value: boolean) => void
  requestNewProject: () => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  focusMode: false,
  commandPaletteOpen: false,
  manuscriptSearchOpen: false,
  mobileNavOpen: false,
  newProjectRequestNonce: 0,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setFocusMode: (value) => set({ focusMode: value }),
  setCommandPaletteOpen: (value) => set({ commandPaletteOpen: value }),
  setManuscriptSearchOpen: (value) => set({ manuscriptSearchOpen: value }),
  setMobileNavOpen: (value) => set({ mobileNavOpen: value }),
  requestNewProject: () => set((s) => ({ newProjectRequestNonce: s.newProjectRequestNonce + 1 })),
}))
