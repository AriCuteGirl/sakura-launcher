use crate::models::achievement::Achievement;
use crate::DbState;
use chrono::Utc;
use tauri::State;

fn row_to_achievement(row: &rusqlite::Row) -> rusqlite::Result<Achievement> {
    Ok(Achievement {
        id: row.get(0)?,
        game_id: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        icon_url: row.get(4)?,
        unlocked: row.get::<_, i64>(5)? != 0,
        unlocked_at: row.get(6)?,
    })
}

#[tauri::command]
pub fn get_achievements(state: State<DbState>, game_id: String) -> Vec<Achievement> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT id, game_id, name, description, icon_url, unlocked, unlocked_at
             FROM achievements WHERE game_id = ?1 ORDER BY name ASC",
        )
        .unwrap();

    stmt.query_map([&game_id], row_to_achievement)
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
}

#[tauri::command]
pub fn add_achievement(state: State<DbState>, achievement: Achievement) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO achievements (id, game_id, name, description, icon_url, unlocked, unlocked_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        rusqlite::params![
            achievement.id,
            achievement.game_id,
            achievement.name,
            achievement.description,
            achievement.icon_url,
            achievement.unlocked as i64,
            achievement.unlocked_at,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Update achievement_count on the game
    conn.execute(
        "UPDATE games SET achievement_count = achievement_count + 1 WHERE id = ?1",
        [&achievement.game_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn unlock_achievement(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    // Get game_id first
    let game_id: Option<String> = conn
        .query_row(
            "SELECT game_id FROM achievements WHERE id = ?1 AND unlocked = 0",
            [&id],
            |row| row.get(0),
        )
        .ok();

    if let Some(gid) = game_id {
        conn.execute(
            "UPDATE achievements SET unlocked = 1, unlocked_at = ?1 WHERE id = ?2",
            rusqlite::params![now, id],
        )
        .map_err(|e| e.to_string())?;

        // Increment achievements_unlocked on game
        conn.execute(
            "UPDATE games SET achievements_unlocked = achievements_unlocked + 1 WHERE id = ?1",
            [&gid],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_total_unlocked(state: State<DbState>) -> u64 {
    let conn = state.0.lock().unwrap();
    conn.query_row(
        "SELECT COALESCE(SUM(achievements_unlocked), 0) FROM games",
        [],
        |row| row.get::<_, i64>(0),
    )
    .unwrap_or(0) as u64
}
