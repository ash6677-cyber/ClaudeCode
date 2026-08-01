/** True when running inside the Tauri desktop shell rather than a plain browser tab. */
export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  return tauriInvoke<T>(command, args)
}

export async function loadLibraryRaw(): Promise<string | null> {
  return invoke<string | null>('load_library')
}

export async function saveLibraryRaw(json: string): Promise<void> {
  return invoke<void>('save_library', { json })
}

export async function createBackup(): Promise<string | null> {
  return invoke<string | null>('create_backup')
}

export interface BackupInfo {
  filename: string
  createdAt: number
  size: number
}

export async function listBackups(): Promise<BackupInfo[]> {
  return invoke<BackupInfo[]>('list_backups')
}

export async function restoreBackupRaw(filename: string): Promise<string> {
  return invoke<string>('restore_backup', { filename })
}

export async function exportLibraryRaw(destPath: string, json: string): Promise<void> {
  return invoke<void>('export_library', { destPath, json })
}

export async function importLibraryRaw(srcPath: string): Promise<string> {
  return invoke<string>('import_library', { srcPath })
}

/** Writes base64-encoded bytes to an absolute path chosen by the user. */
export async function saveBinaryFile(destPath: string, base64: string): Promise<void> {
  return invoke<void>('save_binary_file', { destPath, base64 })
}

/** Tells the Rust side it's safe to actually exit, after the frontend has flushed its save. */
export async function quitAfterSave(): Promise<void> {
  return invoke<void>('quit_after_save')
}
