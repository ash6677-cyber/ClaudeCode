import { useTheme } from 'next-themes'
import { useEffect } from 'react'

import { router } from '@/app/router'
import { useToast } from '@/components/ui/use-toast'
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
  const { toast } = useToast()

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
          case 'check_for_updates':
            void checkForUpdates(true)
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

    // `explicit` controls whether "no update found" / "check failed" get a
    // toast — the boot-time check stays silent unless there's actually
    // something to do, but Help > Check for Updates always reports back.
    async function checkForUpdates(explicit: boolean) {
      try {
        const { check } = await import('@tauri-apps/plugin-updater')
        const update = await check()
        if (!update) {
          if (explicit) toast({ title: "You're up to date" })
          return
        }
        const { ask } = await import('@tauri-apps/plugin-dialog')
        const shouldInstall = await ask(
          `INKWELL ${update.version} is available (you have ${update.currentVersion}). Download and install it now?`,
          { title: 'Update available', kind: 'info' },
        )
        if (!shouldInstall) return
        await update.downloadAndInstall()
        const { relaunch } = await import('@tauri-apps/plugin-process')
        await relaunch()
      } catch {
        if (explicit) toast({ title: 'Could not check for updates', variant: 'destructive' })
      }
    }

    void setup()
    void checkForUpdates(false)
    return () => {
      unlistenMenu?.()
      unlistenQuit?.()
      unlistenDrop?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
