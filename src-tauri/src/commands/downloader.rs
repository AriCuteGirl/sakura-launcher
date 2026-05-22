use crate::DbState;
use crate::PlaytimeSessions;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_opener::OpenerExt;
use tokio::io::AsyncWriteExt;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub game_id: String,
    pub percent: f64,
    pub speed_mbps: f64,
    pub eta_seconds: u64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
}

fn default_install_dir() -> String {
    dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string())))
        .join("sakura-launcher")
        .join("games")
        .to_string_lossy()
        .to_string()
}

#[tauri::command]
pub async fn download_game(
    app: AppHandle,
    url: String,
    install_dir: String,
    game_id: String,
    db: State<'_, DbState>,
    sessions: State<'_, PlaytimeSessions>,
) -> Result<(), String> {
    let db_arc = Arc::clone(&db.0);
    let sessions_arc = Arc::clone(&sessions.0);

    let dir = if install_dir.is_empty() {
        default_install_dir()
    } else {
        install_dir
    };

    let url2 = url.clone();
    let game_id2 = game_id.clone();
    let app2 = app.clone();

    tokio::spawn(async move {
        if let Err(e) = do_download(app2, url2, dir, game_id2, db_arc, sessions_arc).await {
            eprintln!("Download error: {}", e);
            app.emit("download-error", &serde_json::json!({
                "game_id": game_id,
                "error": e
            })).ok();
        }
    });

    Ok(())
}

async fn do_download(
    app: AppHandle,
    url: String,
    install_dir: String,
    game_id: String,
    _db: Arc<std::sync::Mutex<rusqlite::Connection>>,
    _sessions: Arc<std::sync::Mutex<std::collections::HashMap<String, std::time::Instant>>>,
) -> Result<(), String> {
    use futures_util::StreamExt;

    let client = reqwest::Client::builder()
        .tcp_keepalive(Some(Duration::from_secs(30)))
        .pool_max_idle_per_host(10)
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let total_bytes = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let start_time = std::time::Instant::now();

    // Ensure install dir exists
    std::fs::create_dir_all(&install_dir).map_err(|e| e.to_string())?;

    // Create temp file
    let ext = std::path::Path::new(&url)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("zip")
        .to_lowercase();

    let tmp_path = format!("{}/sakura_download_{}.{}", install_dir, game_id, ext);
    let mut file = tokio::fs::File::create(&tmp_path)
        .await
        .map_err(|e| e.to_string())?;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        let elapsed = start_time.elapsed().as_secs_f64();
        let speed_bps = if elapsed > 0.0 { downloaded as f64 / elapsed } else { 0.0 };
        let speed_mbps = speed_bps / (1024.0 * 1024.0);
        let remaining = total_bytes.saturating_sub(downloaded);
        let eta_seconds = if speed_bps > 0.0 { (remaining as f64 / speed_bps) as u64 } else { 0 };
        let percent = if total_bytes > 0 { (downloaded as f64 / total_bytes as f64) * 100.0 } else { 0.0 };

        let progress = DownloadProgress {
            game_id: game_id.clone(),
            percent,
            speed_mbps,
            eta_seconds,
            downloaded_bytes: downloaded,
            total_bytes,
        };

        app.emit("download-progress", &progress).ok();
    }

    file.flush().await.map_err(|e| e.to_string())?;
    drop(file);

    // Extract based on file type
    let game_id_clone = game_id.clone();
    let tmp_path2 = tmp_path.clone();
    let out_dir = install_dir.clone();

    let extract_result = tokio::task::spawn_blocking(move || {
        match ext.as_str() {
            "zip" => extract_zip(&tmp_path2, &out_dir),
            other => Err(format!("Unsupported archive format: .{}", other)),
        }
    })
    .await
    .map_err(|e| format!("Extraction task failed: {}", e))?;

    if let Err(e) = extract_result {
        // Keep the downloaded file so user can extract manually
        eprintln!("Extraction error: {}", e);
        return Err(format!("Extraction failed: {}", e));
    }

    // Remove the archive after successful extraction
    tokio::fs::remove_file(&tmp_path).await.ok();

    // Emit complete
    app.emit("download-complete", &serde_json::json!({ "game_id": game_id_clone })).ok();

    Ok(())
}

/// Open Filen.io download URL in system browser (most reliable)
#[tauri::command]
pub async fn open_filen_download(app: AppHandle, url: String) -> Result<(), String> {
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| format!("Failed to open URL: {e}"))
}

/// Import a locally downloaded game file (for Filen.io / manual downloads)
#[tauri::command]
pub async fn import_game_file(
    app: AppHandle,
    db: State<'_, DbState>,
    file_path: String,
    game_id: String,
    title: String,
    download_url: String,
    cover_url: String,
    developer: String,
    tags: Vec<String>,
) -> Result<(), String> {
    // Determine install directory
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let install_dir = format!("{}/Games/{}", home, game_id);
    std::fs::create_dir_all(&install_dir).map_err(|e| e.to_string())?;

    // Copy file to install dir
    let ext = std::path::Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("zip")
        .to_lowercase();
    let dest_path = format!("{}/game.{}", install_dir, ext);
    tokio::fs::copy(&file_path, &dest_path)
        .await
        .map_err(|e| format!("Failed to copy file: {e}"))?;

    // Extract archive
    match ext.as_str() {
        "zip" => {
            if let Err(e) = extract_zip(&dest_path, &install_dir) {
                eprintln!("Extraction warning: {e}");
            } else {
                tokio::fs::remove_file(&dest_path).await.ok();
            }
        }
        "rar" => {
            if let Err(e) = extract_rar_cmd(&dest_path, &install_dir) {
                eprintln!("Extraction warning: {e}");
            } else {
                tokio::fs::remove_file(&dest_path).await.ok();
            }
        }
        "7z" => {
            if let Err(e) = extract_7z_cmd(&dest_path, &install_dir) {
                eprintln!("Extraction warning: {e}");
            } else {
                tokio::fs::remove_file(&dest_path).await.ok();
            }
        }
        _ => {}
    }

    // Auto-find executable in install dir
    let exe_path = find_main_exe(std::path::Path::new(&install_dir)).unwrap_or_default();

    // Add game to library
    let genre_json = "[]";
    let screenshots_json = "[]";
    let tags_json = serde_json::to_string(&tags).unwrap_or_default();
    let now = chrono::Utc::now().to_rfc3339();

    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO games (id, title, description, genre, cover_url, banner_url, screenshots,
             exe_path, install_dir, bunnycdn_download_url, playtime_seconds, last_played,
             date_added, developer, tags, achievement_count, achievements_unlocked)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)",
            rusqlite::params![
                game_id,
                title,
                "",
                genre_json,
                cover_url,
                "",
                screenshots_json,
                exe_path,
                install_dir,
                download_url,
                0_i64,
                Option::<String>::None,
                now,
                developer,
                tags_json,
                0_i64,
                0_i64,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    app.emit("download-complete", &serde_json::json!({ "game_id": game_id }))
        .ok();

    Ok(())
}

// Helper: find main executable in a directory (copied from scanner.rs)
const EXE_EXTENSIONS: &[&str] = &["exe", "sh", "appimage", "bin", "x86_64", "x86"];
const EXE_EXCLUDE: &[&str] = &[
    "unins", "uninstall", "setup", "install", "redist", "vcredist",
    "directx", "crash", "report", "launcher_old",
];

fn is_game_exe(name: &str) -> bool {
    let lower = name.to_lowercase();
    let has_ext = EXE_EXTENSIONS.iter().any(|ext| lower.ends_with(&format!(".{}", ext)));
    let no_ext_executable = !lower.contains('.');
    if !has_ext && !no_ext_executable {
        return false;
    }
    !EXE_EXCLUDE.iter().any(|ex| lower.contains(ex))
}

fn find_main_exe(dir: &std::path::Path) -> Option<String> {
    let mut candidates: Vec<(usize, String)> = Vec::new();

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if path.is_file() && is_game_exe(&name) {
                let folder_name = dir
                    .file_name()
                    .map(|n| n.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                let score = if name.to_lowercase().contains(&folder_name) { 10 } else { 1 };
                candidates.push((score, path.to_string_lossy().to_string()));
            } else if path.is_dir() {
                if let Ok(sub_entries) = std::fs::read_dir(&path) {
                    for sub_entry in sub_entries.flatten() {
                        let sub_path = sub_entry.path();
                        let sub_name = sub_entry.file_name().to_string_lossy().to_string();
                        if sub_path.is_file() && is_game_exe(&sub_name) {
                            candidates.push((0, sub_path.to_string_lossy().to_string()));
                        }
                    }
                }
            }
        }
    }

    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    candidates.into_iter().next().map(|(_, path)| path)
}

fn extract_zip(zip_path: &str, out_dir: &str) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = std::path::Path::new(out_dir).join(entry.name());

        if entry.is_dir() {
            std::fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = outpath.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut outfile = std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn extract_rar_cmd(rar_path: &str, out_dir: &str) -> Result<(), String> {
    for cmd in &["unrar", "unrar-free"] {
        if let Ok(output) = std::process::Command::new(cmd)
            .args(["x", "-o+", rar_path, out_dir])
            .output()
        {
            if output.status.success() {
                return Ok(());
            }
            return Err(format!("{} failed: {}", cmd, String::from_utf8_lossy(&output.stderr)));
        }
    }
    Err("No RAR extractor found (install unrar)".to_string())
}

fn extract_7z_cmd(seven_z_path: &str, out_dir: &str) -> Result<(), String> {
    for cmd in &["7z", "7za", "7zr"] {
        if let Ok(output) = std::process::Command::new(cmd)
            .args(["x", seven_z_path, &format!("-o{}", out_dir), "-aoa"])
            .output()
        {
            if output.status.success() {
                return Ok(());
            }
            return Err(format!("{} failed: {}", cmd, String::from_utf8_lossy(&output.stderr)));
        }
    }
    Err("No 7z extractor found (install p7zip)".to_string())
}
