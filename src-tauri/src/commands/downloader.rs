use crate::DbState;
use crate::PlaytimeSessions;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
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

    let url2 = url.clone();
    let game_id2 = game_id.clone();
    let install_dir2 = install_dir.clone();
    let app2 = app.clone();

    tokio::spawn(async move {
        if let Err(e) = do_download(app2, url2, install_dir2, game_id2, db_arc, sessions_arc).await {
            eprintln!("Download error: {}", e);
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

    // Create temp file
    let tmp_path = format!("{}/sakura_download_{}.zip", install_dir, game_id);
    std::fs::create_dir_all(&install_dir).map_err(|e| e.to_string())?;

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

    // Extract zip
    let zip_path = tmp_path.clone();
    let out_dir = install_dir.clone();
    let game_id_clone = game_id.clone();

    tokio::task::spawn_blocking(move || {
        extract_zip(&zip_path, &out_dir)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    // Remove zip
    tokio::fs::remove_file(&tmp_path).await.ok();

    app.emit("download-complete", &serde_json::json!({ "game_id": game_id_clone })).ok();

    Ok(())
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
