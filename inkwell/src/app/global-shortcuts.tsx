import { useEffect } from 'react'

import { router } from '@/app/router'
import { isTauriRuntime } from '@/lib/db/tauri-bridge'
import { matchesShortcut } from '@/lib/shortcuts'
import { useUiStore } from '@/stores/ui-store'

/**
 * App-wide shortcuts that aren't owned by any one screen.
 *
 * In the packaged desktop app these same actions hang off native menu
 * accelerators, which the OS handles before the webview sees the keystroke.
 * Registering them here too would risk firing twice — toggling the sidebar
 * closed and open again — so the web handlers stand down under Tauri.
 *
 * Renders nothing; mounted once at the app root, outside the router, so it
 * navigates through the router object rather than `useNavigate`.
 */
export function GlobalShortcuts() {
  useEffect(() => {
    if (isTauriRuntime()) return

    function onKeyDown(event: KeyboardEvent) {
      if (matchesShortcut(event, 'toggle-sidebar')) {
        event.preventDefault()
        useUiStore.getState().toggleSidebar()
        return
      }
      if (matchesShortcut(event, 'settings')) {
        event.preventDefault()
        void router.navigate('/settings')
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return null
}
