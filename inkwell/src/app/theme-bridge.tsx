import { useApplyTheme } from '@/features/theme/lib/use-apply-theme'

/**
 * Wears the active theme.
 *
 * A component rather than a call in `App` because the hook reads the resolved
 * light/dark mode from next-themes, which is only available below the
 * provider. Renders nothing.
 */
export function ThemeBridge() {
  useApplyTheme()
  return null
}
