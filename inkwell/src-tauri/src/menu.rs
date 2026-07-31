use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Runtime, WindowEvent};
use tauri_plugin_dialog::DialogExt;

/// Guards against re-entering the quit flow twice (native Quit item and the
/// window's close button both funnel through [`request_quit`]).
static QUIT_REQUESTED: AtomicBool = AtomicBool::new(false);

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<tauri::menu::Menu<R>> {
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&MenuItemBuilder::with_id("new_project", "New Project").accelerator("CmdOrCtrl+N").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("import_library", "Import Library…").accelerator("CmdOrCtrl+I").build(app)?)
        .item(&MenuItemBuilder::with_id("export_library", "Export Library…").accelerator("CmdOrCtrl+Shift+E").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("settings", "Settings…").accelerator("CmdOrCtrl+,").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("app_quit", "Quit").accelerator("CmdOrCtrl+Q").build(app)?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&MenuItemBuilder::with_id("command_palette", "Command Palette…").accelerator("CmdOrCtrl+K").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("toggle_sidebar", "Toggle Sidebar").accelerator("CmdOrCtrl+B").build(app)?)
        .item(&MenuItemBuilder::with_id("toggle_focus_mode", "Toggle Focus Mode").accelerator("CmdOrCtrl+.").build(app)?)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItemBuilder::with_id("about", "About INKWELL").build(app)?)
        .build()?;

    MenuBuilder::new(app)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .item(&help_menu)
        .build()
}

pub fn handle_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
        "app_quit" => request_quit(app),
        "about" => show_about(app),
        // Every other id is a plain "tell the frontend what happened" action —
        // the UI state (dialogs, stores, navigation) all live in JS.
        other => {
            let _ = app.emit("menu-action", other);
        }
    }
}

fn show_about<R: Runtime>(app: &AppHandle<R>) {
    let version = app.package_info().version.to_string();
    app.dialog()
        .message(format!("INKWELL\nVersion {version}\n\nA calm, local-first novel-writing studio."))
        .title("About INKWELL")
        .blocking_show();
}

/// Routes both the "Quit" menu item and the window's native close button
/// through the same path: ask the frontend to flush its pending (debounced)
/// save to disk, then actually exit. A watchdog thread force-exits after a
/// short grace period so the window can never get stuck un-closable if the
/// frontend fails to respond.
pub fn request_quit<R: Runtime>(app: &AppHandle<R>) {
    if QUIT_REQUESTED.swap(true, Ordering::SeqCst) {
        return;
    }
    let _ = app.emit("app-quit-requested", ());
    let watchdog = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(2000));
        watchdog.exit(0);
    });
}

pub fn handle_window_event<R: Runtime>(app: &AppHandle<R>, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        request_quit(app);
    }
}

/// Called by the frontend once it has flushed its pending save to disk in
/// response to `app-quit-requested`, so the app exits immediately instead of
/// waiting out the watchdog's grace period.
#[tauri::command]
pub fn quit_after_save(app: tauri::AppHandle) {
    app.exit(0);
}
