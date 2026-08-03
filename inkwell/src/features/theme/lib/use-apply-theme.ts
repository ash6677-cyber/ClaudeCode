import { useTheme } from 'next-themes'
import { useEffect } from 'react'

import { applyTheme } from '@/features/theme/lib/apply-theme'
import { resolveTheme, useThemeStore } from '@/stores/theme-store'

/**
 * Keeps the document wearing the active theme.
 *
 * Re-applies when the light/dark mode changes as well as when the theme
 * does, because the two halves of a theme are different palettes and the
 * inline properties this writes sit above both `:root` and `.dark` — nothing
 * swaps them back on its own.
 *
 * Mounted once, at the app root.
 */
export function useApplyTheme(): void {
  const custom = useThemeStore((s) => s.custom)
  const activeId = useThemeStore((s) => s.activeId)
  const load = useThemeStore((s) => s.load)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    // Before next-themes has resolved, `resolvedTheme` is undefined. Treating
    // that as light would flash the wrong palette on every load in the dark,
    // so the built-in stylesheet is left to hold the fort for a frame.
    if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return
    applyTheme(resolveTheme(custom, activeId), resolvedTheme)
  }, [custom, activeId, resolvedTheme])
}
