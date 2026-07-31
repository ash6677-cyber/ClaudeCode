import { useTheme } from 'next-themes'
import { useEffect } from 'react'

import { router } from '@/app/router'
import { flushPendingSave } from '@/lib/db/tauri-db'
import { isTauriRuntime, quitAfterSave } from '@/lib/db/tauri-bridge'
import { useImportStore } from '@/stores/import-store'
import { useUiStore } from '@/stores/ui-store'

const IMPORTABLE_EXTENSIONS = ['.inkwell', '.json']

/**
 * Bridges the native Tauri shell (menu bar, window close button, file drops,
 * OS theme) to the same app state and actions the in-app UI already uses.
 * Renders nothing — it's pure wiring, mounted once at the app root so it
 * works no matter which route is active.
 */
export function DesktopMenuBridge() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (!isTauriRuntime()) return

    let unlistenMenu: (() => void) | undefined
    let unlistenQuit: (() => void) | undefined
    let unlistenDrop: (() => void) | undefined

    async function setup() {
      const { listen } = await import('@tauri-apps/api/event')
      const { getCurrentWebview } = await import('@tauri-apps/api/webview')

      unlistenMenu = await listen<string>('menu-action', (event) => {
        const ui = useUiStore.getState()
        switch (event.payload) {
          case 'new_project':
            router.navigate('/projects')
            ui.requestNewProject()
            break
          case 'settings':
            router.navigate('/settings')
            break
          case 'command_palette':
            ui.setCommandPaletteOpen(true)
            break
          case 'toggle_sidebar':
            ui.toggleSidebar()
            break
          case 'toggle_focus_mode':
            ui.setFocusMode(!ui.focusMode)
            break
          case 'import_library':
            void handleImportRequest()
            break
          case 'export_library':
            void handleExportRequest()
            break
        }
      })

      unlistenQuit = await listen('app-quit-requested', () => {
        void (async () => {
          await flushPendingSave()
          await quitAfterSave()
        })()
      })

      unlistenDrop = await getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type !== 'drop') return
        const path = event.payload.paths.find((p) =>
          IMPORTABLE_EXTENSIONS.some((ext) => p.toLowerCase().endsWith(ext)),
        )
        if (path) useImportStore.getState().setPendingPath(path)
      })
    }

    async function handleImportRequest() {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const path = await open({
        title: 'Import INKWELL library',
        multiple: false,
        filters: [{ name: 'INKWELL library', extensions: ['inkwell', 'json'] }],
      })
      if (path && !Array.isArray(path)) useImportStore.getState().setPendingPath(path)
    }

    async function handleExportRequest() {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { exportLibraryToFile } = await import('@/lib/db/tauri-db')
      const path = await save({
        title: 'Export INKWELL library',
        defaultPath: `inkwell-library-${new Date().toISOString().slice(0, 10)}.inkwell`,
        filters: [{ name: 'INKWELL library', extensions: ['inkwell', 'json'] }],
      })
      if (path) await exportLibraryToFile(path)
    }

    void setup()
    return () => {
      unlistenMenu?.()
      unlistenQuit?.()
      unlistenDrop?.()
    }
  }, [])

  useEffect(() => {
    if (!isTauriRuntime() || !resolvedTheme) return
    void (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().setTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
    })()
  }, [resolvedTheme])

  return null
}
