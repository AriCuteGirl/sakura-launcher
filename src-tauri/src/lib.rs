use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

pub mod commands;
pub mod models;

use commands::{
    achievements::{add_achievement, get_achievements, get_total_unlocked, unlock_achievement},
    catalog::{fetch_catalog, fetch_remote_catalog},
    catalog_manager::{add_catalog_game, is_admin_password_set, load_catalog_manager, publish_catalog, remove_catalog_game, verify_admin_password},
    downloader::download_game,
    downloader::import_game_file,
    downloader::open_filen_download,
    friends::{add_friend, get_friends, remove_friend, set_online_status},
    games::{add_game, get_all_games, get_game_by_id, remove_game, update_game},
    launcher::launch_game,
    launcher::stop_game,
    metadata::fetch_game_metadata,
    playtime::{end_session, get_playtime, start_session, update_playtime},
    s3::{configure_s3, fetch_s3_catalog, generate_s3_download_url, s3_status, S3Client},
    scanner::scan_games,
    settings::{load_settings, save_settings},
    webdav::fetch_webdav_catalog,
};

pub struct DbState(pub Arc<Mutex<rusqlite::Connection>>);
pub struct PlaytimeSessions(pub Arc<Mutex<HashMap<String, std::time::Instant>>>);
pub struct RunningProcesses(pub Arc<Mutex<HashMap<String, u32>>>);

fn init_db(conn: &rusqlite::Connection) {
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;

        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            genre TEXT NOT NULL DEFAULT '[]',
            cover_url TEXT NOT NULL DEFAULT '',
            banner_url TEXT NOT NULL DEFAULT '',
            screenshots TEXT NOT NULL DEFAULT '[]',
            exe_path TEXT NOT NULL DEFAULT '',
            install_dir TEXT NOT NULL DEFAULT '',
            bunnycdn_download_url TEXT,
            playtime_seconds INTEGER NOT NULL DEFAULT 0,
            last_played TEXT,
            date_added TEXT NOT NULL,
            developer TEXT NOT NULL DEFAULT '',
            tags TEXT NOT NULL DEFAULT '[]',
            achievement_count INTEGER NOT NULL DEFAULT 0,
            achievements_unlocked INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS achievements (
            id TEXT PRIMARY KEY,
            game_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            icon_url TEXT NOT NULL DEFAULT '',
            unlocked INTEGER NOT NULL DEFAULT 0,
            unlocked_at TEXT,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS friends (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            online INTEGER NOT NULL DEFAULT 0,
            current_game TEXT
        );
        ",
    )
    .expect("Failed to initialize database");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let dir = format!("{}/.local/share/sakura-launcher", home);
        std::fs::create_dir_all(&dir).ok();
        format!("{}/sakura.db", dir)
    };

    let conn = rusqlite::Connection::open(&db_path).expect("Failed to open SQLite database");
    init_db(&conn);

    let db_state = DbState(Arc::new(Mutex::new(conn)));
    let sessions_state = PlaytimeSessions(Arc::new(Mutex::new(HashMap::new())));
    let processes_state = RunningProcesses(Arc::new(Mutex::new(HashMap::new())));
    let s3_state = S3Client::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(db_state)
        .manage(sessions_state)
        .manage(processes_state)
        .manage(s3_state)
        .invoke_handler(tauri::generate_handler![
            get_all_games,
            add_game,
            update_game,
            remove_game,
            get_game_by_id,
            scan_games,
            fetch_catalog,
            fetch_remote_catalog,
            fetch_game_metadata,
            load_settings,
            save_settings,
            launch_game,
            stop_game,
            download_game,
            import_game_file,
            open_filen_download,
            start_session,
            end_session,
            update_playtime,
            get_playtime,
            get_achievements,
            add_achievement,
            unlock_achievement,
            get_total_unlocked,
            get_friends,
            add_friend,
            remove_friend,
            set_online_status,
            load_catalog_manager,
            add_catalog_game,
            remove_catalog_game,
            publish_catalog,
            is_admin_password_set,
            verify_admin_password,
            fetch_webdav_catalog,
            fetch_s3_catalog,
            configure_s3,
            s3_status,
            generate_s3_download_url,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Auto-configure S3 from settings
            let s3_state: tauri::State<S3Client> = app.state();
            let settings_path = app.path().app_config_dir().ok().map(|d| d.join("sakura_settings.json"));
            if let Some(path) = settings_path {
                if path.exists() {
                    if let Ok(json) = std::fs::read_to_string(&path) {
                        if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&json) {
                            let endpoint = settings.get("filen_s3_endpoint").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let region = settings.get("filen_s3_region").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let bucket = settings.get("filen_s3_bucket").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let access_key = settings.get("filen_s3_access_key").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let secret_key = settings.get("filen_s3_secret_key").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            if !endpoint.is_empty() && !access_key.is_empty() && !secret_key.is_empty() {
                                let s3 = s3_state.inner().clone();
                                tauri::async_runtime::spawn(async move {
                                    if let Err(e) = s3.configure(&endpoint, &region, &bucket, &access_key, &secret_key).await {
                                        eprintln!("S3 auto-config failed: {e}");
                                    } else {
                                        eprintln!("S3 auto-configured successfully");
                                    }
                                });
                            }
                        }
                    }
                }
            }

            // Build tray menu
            let open_i = MenuItem::with_id(app, "open", "Open Sakura", true, None::<&str>)?;
            let playing_i = MenuItem::with_id(app, "playing", "Not playing", false, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &playing_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            window.show().ok();
                            window.set_focus().ok();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                window.hide().ok();
                            } else {
                                window.show().ok();
                                window.set_focus().ok();
                            }
                        }
                    }
                })
                .build(app)?;

            // Close to tray behaviour
            let app_handle2 = app_handle.clone();
            if let Some(window) = app_handle2.get_webview_window("main") {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Some(win) = app_handle.get_webview_window("main") {
                            win.hide().ok();
                        }
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
