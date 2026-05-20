use crate::models::friend::Friend;
use crate::DbState;
use tauri::State;
use uuid::Uuid;

fn row_to_friend(row: &rusqlite::Row) -> rusqlite::Result<Friend> {
    Ok(Friend {
        id: row.get(0)?,
        username: row.get(1)?,
        online: row.get::<_, i64>(2)? != 0,
        current_game: row.get(3)?,
    })
}

#[tauri::command]
pub fn get_friends(state: State<DbState>) -> Vec<Friend> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, username, online, current_game FROM friends ORDER BY username ASC")
        .unwrap();

    stmt.query_map([], row_to_friend)
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
}

#[tauri::command]
pub fn add_friend(state: State<DbState>, username: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO friends (id, username, online, current_game) VALUES (?1, ?2, 0, NULL)",
        rusqlite::params![id, username],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn remove_friend(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM friends WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_online_status(state: State<DbState>, id: String, online: bool) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE friends SET online = ?1 WHERE id = ?2",
        rusqlite::params![online as i64, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
