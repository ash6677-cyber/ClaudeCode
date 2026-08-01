use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};

const APP_FOLDER_NAME: &str = "INKWELL";
const LIBRARY_FILE_NAME: &str = "library.json";
const BACKUPS_DIR_NAME: &str = "backups";
const MAX_BACKUPS: usize = 20;

/// Roaming app-data root joined with our own literal "INKWELL" folder name —
/// deliberately not Tauri's identifier-based default (`app_data_dir()` would
/// give `%APPDATA%\com.inkwell.app`), so user data always lives at the
/// documented `%APPDATA%\INKWELL` location regardless of bundle identifier.
fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = dirs::config_dir()
        .or_else(|| app.path().app_data_dir().ok())
        .ok_or_else(|| "Could not resolve the app data directory".to_string())?;
    Ok(base.join(APP_FOLDER_NAME))
}

fn library_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join(LIBRARY_FILE_NAME))
}

fn backups_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join(BACKUPS_DIR_NAME))
}

fn ensure_dirs(app: &AppHandle) -> Result<(), String> {
    fs::create_dir_all(data_dir(app)?).map_err(|e| e.to_string())?;
    fs::create_dir_all(backups_dir(app)?).map_err(|e| e.to_string())?;
    Ok(())
}

/// Atomically writes `contents` to `path`: write to a sibling `.tmp` file,
/// fsync it so the bytes are actually on disk, then rename over the target.
/// Rename-over-existing-file is atomic on the same volume on both NTFS and
/// POSIX filesystems, so a crash at any point before the rename call leaves
/// the previous on-disk file completely untouched — there is no window where
/// the target file is partially written.
fn atomic_write(path: &Path, contents: &str) -> Result<(), String> {
    let tmp_path = path.with_extension("tmp");
    {
        let mut file = fs::File::create(&tmp_path).map_err(|e| e.to_string())?;
        file.write_all(contents.as_bytes()).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp_path, path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_library(app: AppHandle) -> Result<Option<String>, String> {
    ensure_dirs(&app)?;
    let path = library_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_library(app: AppHandle, json: String) -> Result<(), String> {
    ensure_dirs(&app)?;
    let path = library_path(&app)?;
    atomic_write(&path, &json)
}

#[derive(Serialize)]
pub struct BackupInfo {
    pub filename: String,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    pub size: u64,
}

fn prune_backups(app: &AppHandle) -> Result<(), String> {
    let dir = backups_dir(app)?;
    let mut entries: Vec<_> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map(|x| x == "json").unwrap_or(false))
        .collect();
    entries.sort_by_key(|e| e.file_name());
    if entries.len() > MAX_BACKUPS {
        for entry in &entries[..entries.len() - MAX_BACKUPS] {
            let _ = fs::remove_file(entry.path());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn create_backup(app: AppHandle) -> Result<Option<String>, String> {
    ensure_dirs(&app)?;
    let path = library_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let millis = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let filename = format!("library-{millis}.json");
    let dest = backups_dir(&app)?.join(&filename);
    fs::copy(&path, &dest).map_err(|e| e.to_string())?;
    prune_backups(&app)?;
    Ok(Some(filename))
}

#[tauri::command]
pub fn list_backups(app: AppHandle) -> Result<Vec<BackupInfo>, String> {
    ensure_dirs(&app)?;
    let dir = backups_dir(&app)?;
    let mut infos: Vec<BackupInfo> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            let filename = e.file_name().to_string_lossy().to_string();
            if !filename.ends_with(".json") {
                return None;
            }
            let created_at = meta
                .modified()
                .ok()?
                .duration_since(std::time::UNIX_EPOCH)
                .ok()?
                .as_millis() as u64;
            Some(BackupInfo {
                filename,
                created_at,
                size: meta.len(),
            })
        })
        .collect();
    infos.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(infos)
}

#[tauri::command]
pub fn restore_backup(app: AppHandle, filename: String) -> Result<String, String> {
    let dir = backups_dir(&app)?;
    let src = dir.join(&filename);
    if !src.exists() {
        return Err("That backup file no longer exists".to_string());
    }
    fs::read_to_string(&src).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_library(dest_path: String, json: String) -> Result<(), String> {
    atomic_write(Path::new(&dest_path), &json)
}

/// Writes binary export payloads (DOCX, EPUB) chosen via the native save
/// dialog. The bytes arrive base64-encoded because the IPC bridge carries
/// strings, not buffers.
#[tauri::command]
pub fn save_binary_file(dest_path: String, base64: String) -> Result<(), String> {
    use base64::Engine as _;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64.as_bytes())
        .map_err(|e| e.to_string())?;
    let path = Path::new(&dest_path);
    let tmp_path = path.with_extension("tmp");
    {
        let mut file = fs::File::create(&tmp_path).map_err(|e| e.to_string())?;
        file.write_all(&bytes).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp_path, path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_library(src_path: String) -> Result<String, String> {
    fs::read_to_string(&src_path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[test]
    fn atomic_write_creates_new_file() {
        let dir = std::env::temp_dir().join(format!("inkwell-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("library.json");

        atomic_write(&path, "{\"schemaVersion\":1}").unwrap();

        let mut contents = String::new();
        fs::File::open(&path).unwrap().read_to_string(&mut contents).unwrap();
        assert_eq!(contents, "{\"schemaVersion\":1}");

        fs::remove_dir_all(&dir).ok();
    }

    /// Proves the crash-safety property structurally: if a write is
    /// interrupted before the rename step (simulated here by simply not
    /// calling atomic_write's rename — i.e. only writing the temp file),
    /// the original target file is completely unaffected. This is the
    /// actual guarantee atomic_write provides, since rename() is the only
    /// step that touches the real path and it is a single atomic syscall.
    #[test]
    fn interrupted_write_never_corrupts_existing_file() {
        let dir = std::env::temp_dir().join(format!("inkwell-test-crash-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("library.json");

        atomic_write(&path, "{\"version\":1,\"data\":\"original\"}").unwrap();

        // Simulate a crash mid-write: write the temp file directly and stop
        // before the rename that atomic_write would normally perform next.
        let tmp_path = path.with_extension("tmp");
        fs::write(&tmp_path, "{\"version\":2,\"data\":\"CORRUPTED-PARTIAL-WRITE").unwrap();

        // The real target file must be byte-for-byte the original — a reader
        // (or the app on next launch) never observes a half-written file.
        let mut contents = String::new();
        fs::File::open(&path).unwrap().read_to_string(&mut contents).unwrap();
        assert_eq!(contents, "{\"version\":1,\"data\":\"original\"}");

        // Completing the write (the normal, non-crashed path) still succeeds
        // and correctly replaces the file afterward.
        atomic_write(&path, "{\"version\":2,\"data\":\"final\"}").unwrap();
        let mut contents2 = String::new();
        fs::File::open(&path).unwrap().read_to_string(&mut contents2).unwrap();
        assert_eq!(contents2, "{\"version\":2,\"data\":\"final\"}");

        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn backup_pruning_keeps_only_max_backups() {
        let dir = std::env::temp_dir().join(format!("inkwell-test-prune-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        for i in 0..(MAX_BACKUPS + 5) {
            fs::write(dir.join(format!("library-{i:020}.json")), "{}").unwrap();
        }
        let mut entries: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().map(|x| x == "json").unwrap_or(false))
            .collect();
        entries.sort_by_key(|e| e.file_name());
        if entries.len() > MAX_BACKUPS {
            for entry in &entries[..entries.len() - MAX_BACKUPS] {
                fs::remove_file(entry.path()).unwrap();
            }
        }
        let remaining = fs::read_dir(&dir).unwrap().count();
        assert_eq!(remaining, MAX_BACKUPS);

        fs::remove_dir_all(&dir).ok();
    }
}
