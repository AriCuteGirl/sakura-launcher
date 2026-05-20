use crate::DbState;
use crate::PlaytimeSessions;
use chrono::Utc;
use tauri::State;

#[tauri::command]
pub fn start_session(game_id: String, sessions: State<PlaytimeSessions>) -> Result<(), String> {
    let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
    map.insert(game_id, std::time::Instant::now());
    Ok(())
}

#[tauri::command]
pub fn end_session(game_id: String, sessions: State<PlaytimeSessions>, db: State<DbState>) -> Result<u64, String> {
    let elapsed = {
        let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
        match map.remove(&game_id) {
            Some(start) => start.elapsed().as_secs(),
            None => return Ok(0),
        }
    };

    if elapsed > 0 {
        update_playtime_inner(&game_id, elapsed, &db)?;
    }

    Ok(elapsed)
}

fn update_playtime_inner(game_id: &str, seconds: u64, db: &State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE games SET playtime_seconds = playtime_seconds + ?1, last_played = ?2 WHERE id = ?3",
        rusqlite::params![seconds as i64, now, game_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_playtime(game_id: String, seconds: u64, db: State<DbState>) -> Result<(), String> {
    update_playtime_inner(&game_id, seconds, &db)
}

#[tauri::command]
pub fn get_playtime(game_id: String, db: State<DbState>) -> u64 {
    let conn = db.0.lock().unwrap();
    conn.query_row(
        "SELECT playtime_seconds FROM games WHERE id = ?1",
        [&game_id],
        |row| row.get::<_, i64>(0),
    )
    .unwrap_or(0) as u64
}
