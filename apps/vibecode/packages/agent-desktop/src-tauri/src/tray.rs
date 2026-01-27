use crate::state::ConnectionStatus;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

/// Generate a simple colored icon (16x16 RGBA)
fn generate_icon(r: u8, g: u8, b: u8) -> Vec<u8> {
    let size = 16;
    let mut rgba = Vec::with_capacity(size * size * 4);

    for y in 0..size {
        for x in 0..size {
            // Create a circular icon
            let dx = (x as f32) - (size as f32 / 2.0) + 0.5;
            let dy = (y as f32) - (size as f32 / 2.0) + 0.5;
            let dist = (dx * dx + dy * dy).sqrt();
            let radius = size as f32 / 2.0 - 1.0;

            if dist <= radius {
                // Inside circle
                rgba.push(r);
                rgba.push(g);
                rgba.push(b);
                rgba.push(255);
            } else if dist <= radius + 1.0 {
                // Anti-aliased edge
                let alpha = ((radius + 1.0 - dist) * 255.0) as u8;
                rgba.push(r);
                rgba.push(g);
                rgba.push(b);
                rgba.push(alpha);
            } else {
                // Outside - transparent
                rgba.push(0);
                rgba.push(0);
                rgba.push(0);
                rgba.push(0);
            }
        }
    }

    rgba
}

fn get_icon_for_status(status: ConnectionStatus) -> Image<'static> {
    let (r, g, b) = match status {
        ConnectionStatus::Connected => (34, 197, 94),    // Green
        ConnectionStatus::Working => (234, 179, 8),      // Yellow
        ConnectionStatus::Disconnected => (239, 68, 68), // Red
        ConnectionStatus::Connecting => (156, 163, 175), // Gray
        ConnectionStatus::Paused => (156, 163, 175),     // Gray
    };

    let rgba = generate_icon(r, g, b);
    // Use new_owned for raw RGBA pixel data with explicit dimensions
    Image::new_owned(rgba, 16, 16)
}

/// Create the system tray icon and menu
pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<TrayIcon<R>> {
    let show_item = MenuItem::with_id(app, "show", "Show Status Window", true, None::<&str>)?;
    let connect_item = MenuItem::with_id(app, "connect", "Connect", true, None::<&str>)?;
    let disconnect_item = MenuItem::with_id(app, "disconnect", "Disconnect", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings...", true, None::<&str>)?;
    let updates_item = MenuItem::with_id(app, "updates", "Check for Updates", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &connect_item,
            &disconnect_item,
            &settings_item,
            &updates_item,
            &quit_item,
        ],
    )?;

    let icon = get_icon_for_status(ConnectionStatus::Disconnected);

    let tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("Vibecode Agent - Disconnected")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            handle_menu_event(app, event.id.as_ref());
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                show_main_window(app);
            }
        })
        .build(app)?;

    Ok(tray)
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
        "show" => {
            show_main_window(app);
        }
        "connect" => {
            let _ = app.emit("tray-connect", ());
        }
        "disconnect" => {
            let _ = app.emit("tray-disconnect", ());
        }
        "settings" => {
            let _ = app.emit("tray-settings", ());
            show_main_window(app);
        }
        "updates" => {
            let _ = app.emit("tray-check-updates", ());
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Update the tray icon based on connection status
pub fn update_tray_icon<R: Runtime>(
    tray: &TrayIcon<R>,
    status: ConnectionStatus,
) -> tauri::Result<()> {
    let tooltip = match status {
        ConnectionStatus::Connected => "Vibecode Agent - Connected",
        ConnectionStatus::Working => "Vibecode Agent - Working...",
        ConnectionStatus::Disconnected => "Vibecode Agent - Disconnected",
        ConnectionStatus::Connecting => "Vibecode Agent - Connecting...",
        ConnectionStatus::Paused => "Vibecode Agent - Paused",
    };

    let icon = get_icon_for_status(status);
    tray.set_icon(Some(icon))?;
    tray.set_tooltip(Some(tooltip))?;

    Ok(())
}

/// Update menu items based on connection state
pub fn update_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    _tray: &TrayIcon<R>,
    is_connected: bool,
) -> tauri::Result<()> {
    let _ = app.emit(
        "connection-state-changed",
        serde_json::json!({ "connected": is_connected }),
    );
    Ok(())
}
