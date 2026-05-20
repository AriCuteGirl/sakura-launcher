use crate::DbState;
use crate::PlaytimeSessions;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchEvent {
    pub game_id: String,
}

#[tauri::command]
pub async fn launch_game(
    app: AppHandle,
    exe_path: String,
    game_id: String,
    db: State<'_, DbState>,
    sessions: State<'_, PlaytimeSessions>,
) -> Result<(), String> {
    // Start playtime session
    {
        let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
        map.insert(game_id.clone(), std::time::Instant::now());
    }

    // Emit launched event
    app.emit("game-launched", &LaunchEvent { game_id: game_id.clone() }).ok();

    // Update last_played immediately
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE games SET last_played = ?1 WHERE id = ?2",
            rusqlite::params![now, &game_id],
        )
        .ok();
    }

    let db_arc = std::sync::Arc::clone(&db.0);
    let sessions_arc = std::sync::Arc::clone(&sessions.0);
    let app2 = app.clone();
    let exe = exe_path.clone();
    let gid = game_id.clone();

    tokio::spawn(async move {
        // Determine directory and executable
        let path = std::path::Path::new(&exe);
        let dir = path.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_else(|| ".".to_string());
        let file = path.file_name().map(|f| f.to_string_lossy().to_string()).unwrap_or(exe.clone());

        let _result = tokio::process::Command::new(&file)
            .current_dir(&dir)
            .status()
            .await;

        // End session and persist playtime
        let elapsed = {
            let mut map = sessions_arc.lock().unwrap();
            map.remove(&gid).map(|s| s.elapsed().as_secs()).unwrap_or(0)
        };

        if elapsed > 0 {
            let conn = db_arc.lock().unwrap();
            let now = Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE games SET playtime_seconds = playtime_seconds + ?1, last_played = ?2 WHERE id = ?3",
                rusqlite::params![elapsed as i64, now, &gid],
            ).ok();
        }

        app2.emit("game-exited", &serde_json::json!({ "game_id": gid, "playtime_seconds": elapsed })).ok();
    });

    Ok(())
}
