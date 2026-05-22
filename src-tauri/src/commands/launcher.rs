use crate::DbState;
use crate::PlaytimeSessions;
use crate::RunningProcesses;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State, Manager};

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
    processes: State<'_, RunningProcesses>,
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

    let processes_arc = Arc::clone(&processes.0);
    let db_arc = std::sync::Arc::clone(&db.0);
    let sessions_arc = std::sync::Arc::clone(&sessions.0);
    let app2 = app.clone();
    let exe = exe_path.clone();
    let gid = game_id.clone();

    // Determine directory and executable
    let path = std::path::Path::new(&exe);
    let dir = path.parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_else(|| ".".to_string());
    let file = path.file_name().map(|f| f.to_string_lossy().to_string()).unwrap_or(exe.clone());

    // Use Wine for .exe on Linux, run directly on Windows
    let is_exe = file.to_lowercase().ends_with(".exe");
    let use_wine = is_exe && cfg!(target_os = "linux");

    let child_result = if use_wine {
        tokio::process::Command::new("wine")
            .arg(&file)
            .current_dir(&dir)
            .kill_on_drop(true)
            .spawn()
    } else {
        tokio::process::Command::new(&file)
            .current_dir(&dir)
            .kill_on_drop(true)
            .spawn()
    };

    match child_result {
        Ok(mut child) => {
            // Store process ID for stop button
            {
                let mut map = processes_arc.lock().unwrap();
                map.insert(gid.clone(), child.id().unwrap_or(0));
            }

            // Wait for process to exit in background
            let gid2 = gid.clone();
            let processes_arc2 = Arc::clone(&processes_arc);
            let sessions_arc2 = Arc::clone(&sessions_arc);
            let db_arc2 = Arc::clone(&db_arc);
            let app3 = app2.clone();

            tokio::spawn(async move {
                let _ = child.wait().await;

                // Remove from running processes
                {
                    let mut map = processes_arc2.lock().unwrap();
                    map.remove(&gid2);
                }

                // End session and persist playtime
                let elapsed = {
                    let mut map = sessions_arc2.lock().unwrap();
                    map.remove(&gid2).map(|s| s.elapsed().as_secs()).unwrap_or(0)
                };

                if elapsed > 0 {
                    let conn = db_arc2.lock().unwrap();
                    let now = Utc::now().to_rfc3339();
                    conn.execute(
                        "UPDATE games SET playtime_seconds = playtime_seconds + ?1, last_played = ?2 WHERE id = ?3",
                        rusqlite::params![elapsed as i64, now, &gid2],
                    ).ok();
                }

                app3.emit("game-exited", &serde_json::json!({ "game_id": gid2, "playtime_seconds": elapsed })).ok();
            });
        }
        Err(e) => {
            // Clean up session
            {
                let mut map = sessions.0.lock().unwrap();
                map.remove(&gid);
            }
            return Err(format!("Failed to launch: {e}"));
        }
    }

    Ok(())
}

/// Stop a running game by killing its process
#[tauri::command]
pub async fn stop_game(
    app: AppHandle,
    game_id: String,
    sessions: State<'_, PlaytimeSessions>,
    processes: State<'_, RunningProcesses>,
) -> Result<(), String> {
    let pid = {
        let mut map = processes.0.lock().map_err(|e| e.to_string())?;
        map.remove(&game_id)
    };

    if let Some(pid) = pid {
        // Kill the process
        #[cfg(target_os = "windows")]
        let result = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .status();

        #[cfg(not(target_os = "windows"))]
        let result = std::process::Command::new("kill")
            .arg(pid.to_string())
            .status();

        if let Err(e) = result {
            eprintln!("Failed to kill process {}: {}", pid, e);
        }

        // End playtime session
        let elapsed = {
            let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
            map.remove(&game_id).map(|s| s.elapsed().as_secs()).unwrap_or(0)
        };

        app.emit("game-stopped", &serde_json::json!({
            "game_id": game_id,
            "playtime_seconds": elapsed
        })).ok();
    }

    Ok(())
}
