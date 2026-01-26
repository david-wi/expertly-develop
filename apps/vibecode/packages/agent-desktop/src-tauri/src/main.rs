// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod metrics;
mod state;
mod tools;
mod tray;
mod websocket;

use state::{AgentSettings, AppState, ConnectionStatus, LogEntry, SystemMetrics};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Listener, Manager, State};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_deep_link::DeepLinkExt;

type AppStateHandle = Arc<AppState>;

/// Get current connection status
#[tauri::command]
fn get_status(state: State<AppStateHandle>) -> ConnectionStatus {
    state.get_status()
}

/// Get current system metrics
#[tauri::command]
fn get_metrics(state: State<AppStateHandle>) -> SystemMetrics {
    metrics::collect_system_metrics(&state)
}

/// Get recent logs
#[tauri::command]
fn get_logs(state: State<AppStateHandle>) -> Vec<LogEntry> {
    state.logs.read().iter().cloned().collect()
}

/// Get current settings
#[tauri::command]
fn get_settings(state: State<AppStateHandle>) -> AgentSettings {
    state.settings.read().clone()
}

/// Update settings
#[tauri::command]
async fn update_settings(
    settings: AgentSettings,
    state: State<'_, AppStateHandle>,
    app: AppHandle,
) -> Result<(), String> {
    use tauri_plugin_store::StoreExt;

    *state.settings.write() = settings.clone();

    // Persist settings
    if let Ok(store) = app.store("settings.json") {
        let _ = store.set("settings", serde_json::to_value(&settings).unwrap());
        let _ = store.save();
    }

    state.log_info("Settings updated");
    Ok(())
}

/// Connect to the WebSocket server
#[tauri::command]
async fn connect(state: State<'_, AppStateHandle>, app: AppHandle) -> Result<(), String> {
    if *state.is_connected.read() {
        return Ok(());
    }

    let state = state.inner().clone();
    tokio::spawn(async move {
        websocket::start_connection(app, state).await;
    });

    Ok(())
}

/// Disconnect from the server
#[tauri::command]
fn disconnect(state: State<AppStateHandle>) -> Result<(), String> {
    websocket::disconnect(&state);
    state.log_info("Disconnected by user");
    Ok(())
}

/// Select a directory using native dialog
#[tauri::command]
async fn select_directory(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let (tx, rx) = std::sync::mpsc::channel();

    app.dialog()
        .file()
        .set_title("Select Working Directory")
        .pick_folder(move |path| {
            let _ = tx.send(path.map(|p| p.to_string()));
        });

    match rx.recv() {
        Ok(Some(path)) => Ok(Some(path)),
        Ok(None) => Ok(None),
        Err(_) => Ok(None),
    }
}

/// Check for updates
#[tauri::command]
async fn check_for_updates(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_updater::UpdaterExt;

    match app.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                // Update available
                let _ = app.emit("update-available", serde_json::json!({
                    "version": update.version,
                    "body": update.body,
                }));
                Ok(true)
            }
            Ok(None) => Ok(false),
            Err(e) => Err(format!("Failed to check for updates: {}", e)),
        },
        Err(e) => Err(format!("Updater not available: {}", e)),
    }
}

/// Install available update
#[tauri::command]
async fn install_update(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;

    match app.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                let _ = update.download_and_install(|_, _| {}, || {}).await;
                Ok(())
            }
            Ok(None) => Err("No update available".to_string()),
            Err(e) => Err(format!("Failed to install update: {}", e)),
        },
        Err(e) => Err(format!("Updater not available: {}", e)),
    }
}

fn main() {
    let state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(state.clone())
        .setup(move |app| {
            let handle = app.handle().clone();
            let state_clone = state.clone();

            // Load saved settings using the store plugin
            use tauri_plugin_store::StoreExt;
            if let Ok(store) = app.store("settings.json") {
                if let Some(settings_value) = store.get("settings") {
                    if let Ok(settings) = serde_json::from_value::<AgentSettings>(settings_value.clone()) {
                        *state_clone.settings.write() = settings;
                    }
                }
            }

            // Create system tray
            let _tray = tray::create_tray(&handle)?;

            // Listen for tray events
            let state_for_connect = state_clone.clone();
            let handle_for_connect = handle.clone();
            app.listen("tray-connect", move |_| {
                let state = state_for_connect.clone();
                let app = handle_for_connect.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = websocket::start_connection(app, state).await;
                });
            });

            let state_for_disconnect = state_clone.clone();
            app.listen("tray-disconnect", move |_| {
                websocket::disconnect(&state_for_disconnect);
            });

            // Auto-connect if enabled
            let settings = state_clone.settings.read().clone();
            if settings.auto_connect_on_launch {
                let state_for_auto = state_clone.clone();
                let handle_for_auto = handle.clone();
                tauri::async_runtime::spawn(async move {
                    websocket::start_connection(handle_for_auto, state_for_auto).await;
                });
            }

            // Check for updates silently
            let handle_for_updates = handle.clone();
            tauri::async_runtime::spawn(async move {
                use tauri_plugin_updater::UpdaterExt;
                if let Ok(updater) = handle_for_updates.updater() {
                    if let Ok(Some(update)) = updater.check().await {
                        let _ = handle_for_updates.emit("update-available", serde_json::json!({
                            "version": update.version,
                            "body": update.body,
                        }));
                    }
                }
            });

            // Handle deep link URLs (vibecode://connect, etc.)
            let state_for_deeplink = state_clone.clone();
            let handle_for_deeplink = handle.clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    log::info!("Deep link received: {}", url);

                    // Parse the URL scheme and path
                    if url.scheme() == "vibecode" {
                        match url.host_str() {
                            Some("connect") | None if url.path() == "/connect" || url.path() == "connect" => {
                                // Trigger connection
                                let state = state_for_deeplink.clone();
                                let app = handle_for_deeplink.clone();

                                if !*state.is_connected.read() {
                                    state.log_info("Connection triggered via deep link");
                                    tauri::async_runtime::spawn(async move {
                                        let _ = websocket::start_connection(app, state).await;
                                    });
                                }

                                // Show the main window
                                if let Some(window) = handle_for_deeplink.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            Some("show") | None if url.path() == "/show" || url.path() == "show" => {
                                // Just show the window
                                if let Some(window) = handle_for_deeplink.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            _ => {
                                log::warn!("Unknown deep link path: {}", url);
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_status,
            get_metrics,
            get_logs,
            get_settings,
            update_settings,
            connect,
            disconnect,
            select_directory,
            check_for_updates,
            install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
