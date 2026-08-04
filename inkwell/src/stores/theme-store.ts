import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { BUILT_IN_THEMES, DEFAULT_THEME_ID, findPreset } from '@/features/theme/lib/presets'
import { themeRepo } from '@/lib/db/repositories'
import type { Theme, ThemePalette } from '@/types'

/** A theme as the picker sees it, whether it ships or the writer built it. */
export interface ThemeChoice {
  id: string
  name: string
  description: string
  light: ThemePalette
  dark: ThemePalette
  page?: Theme['page']
  shape?: Theme['shape']
  type?: Theme['type']
  custom: boolean
}

export type ThemeDraft = Pick<
  Theme,
  'name' | 'description' | 'light' | 'dark' | 'page' | 'shape' | 'type'
>

interface ThemeState {
  custom: Theme[]
  /**
   * Which look is on. Kept in local storage rather than in the synced table
   * because it is a property of this screen, not of the library: a writer on
   * a bright laptop and a dark desktop wants a different answer on each.
   */
  activeId: string
  /**
   * The look of the book currently open, when it has asked for one of its own.
   *
   * Not persisted and not part of the picker: it is a fact about where the
   * writer is standing, and it stops being true the moment they leave. A
   * project's chosen theme lives on the project record; this is only the
   * app noticing that one is open.
   */
  projectThemeId: string | null
  status: 'idle' | 'loading' | 'ready'
  load: () => Promise<void>
  setActive: (id: string) => void
  setProjectTheme: (id: string | null) => void
  save: (draft: ThemeDraft, id?: string) => Promise<string>
  remove: (id: string) => Promise<void>
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      custom: [],
      activeId: DEFAULT_THEME_ID,
      projectThemeId: null,
      status: 'idle',

      load: async () => {
        set({ status: 'loading' })
        const custom = await themeRepo.list()
        custom.sort((a, b) => a.name.localeCompare(b.name))
        set({ custom, status: 'ready' })
      },

      setActive: (id) => set({ activeId: id }),

      setProjectTheme: (id) =>
        // Guarded so navigating between screens of the same book does not
        // restate the same id and re-run every theme effect downstream.
        set((state) => (state.projectThemeId === id ? state : { projectThemeId: id })),

      save: async (draft, id) => {
        if (id) {
          await themeRepo.update(id, draft)
          await get().load()
          return id
        }
        const created = await themeRepo.create(draft)
        await get().load()
        return created.id
      },

      remove: async (id) => {
        await themeRepo.remove(id)
        // Deleting the look you are wearing has to leave you wearing
        // something, or the app renders with a theme it cannot find.
        if (get().activeId === id) set({ activeId: DEFAULT_THEME_ID })
        await get().load()
      },
    }),
    {
      name: 'inkwell-theme',
      partialize: (state) => ({ activeId: state.activeId }),
    },
  ),
)

/**
 * Which theme is actually on: the open book's, or the one the writer chose.
 *
 * A book's own look wins while it is open, because that is the point of
 * giving one to a book — a horror novel that goes back to the app's default
 * the moment you glance at the outline has not really been given a look.
 */
export function activeThemeId(state: Pick<ThemeState, 'activeId' | 'projectThemeId'>): string {
  return state.projectThemeId ?? state.activeId
}

export function themeChoices(custom: Theme[]): ThemeChoice[] {
  return [
    ...BUILT_IN_THEMES.map((preset) => ({ ...preset, custom: false })),
    ...custom.map((theme) => ({
      id: theme.id,
      name: theme.name,
      description: theme.description,
      light: theme.light,
      dark: theme.dark,
      page: theme.page,
      shape: theme.shape,
      type: theme.type,
      custom: true,
    })),
  ]
}

/**
 * The look to apply, or null for the built-in one.
 *
 * Falls back rather than throwing when the id names nothing: a theme deleted
 * on another device leaves this one holding an id that no longer exists, and
 * the right answer to that is the default look, not a blank screen.
 */
export function resolveTheme(
  custom: Theme[],
  activeId: string,
): Pick<Theme, 'light' | 'dark' | 'page' | 'shape' | 'type'> | null {
  const preset = findPreset(activeId)
  if (preset) return preset.id === DEFAULT_THEME_ID ? null : preset
  return custom.find((theme) => theme.id === activeId) ?? null
}
