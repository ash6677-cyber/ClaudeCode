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
  custom: boolean
}

export type ThemeDraft = Pick<
  Theme,
  'name' | 'description' | 'light' | 'dark' | 'page' | 'shape'
>

interface ThemeState {
  custom: Theme[]
  /**
   * Which look is on. Kept in local storage rather than in the synced table
   * because it is a property of this screen, not of the library: a writer on
   * a bright laptop and a dark desktop wants a different answer on each.
   */
  activeId: string
  status: 'idle' | 'loading' | 'ready'
  load: () => Promise<void>
  setActive: (id: string) => void
  save: (draft: ThemeDraft, id?: string) => Promise<string>
  remove: (id: string) => Promise<void>
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      custom: [],
      activeId: DEFAULT_THEME_ID,
      status: 'idle',

      load: async () => {
        set({ status: 'loading' })
        const custom = await themeRepo.list()
        custom.sort((a, b) => a.name.localeCompare(b.name))
        set({ custom, status: 'ready' })
      },

      setActive: (id) => set({ activeId: id }),

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
): Pick<Theme, 'light' | 'dark' | 'page' | 'shape'> | null {
  const preset = findPreset(activeId)
  if (preset) return preset.id === DEFAULT_THEME_ID ? null : preset
  return custom.find((theme) => theme.id === activeId) ?? null
}
