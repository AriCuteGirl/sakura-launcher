use crate::models::game::Game;
use crate::DbState;
use serde_json;
use tauri::State;

fn row_to_game(row: &rusqlite::Row) -> rusqlite::Result<Game> {
    let genre_str: String = row.get(3)?;
    let screenshots_str: String = row.get(6)?;
    let tags_str: String = row.get(14)?;

    let genre: Vec<String> = serde_json::from_str(&genre_str).unwrap_or_default();
    let screenshots: Vec<String> = serde_json::from_str(&screenshots_str).unwrap_or_default();
    let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();

    Ok(Game {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        genre,
        cover_url: row.get(4)?,
        banner_url: row.get(5)?,
        screenshots,
        exe_path: row.get(7)?,
        install_dir: row.get(8)?,
        bunnycdn_download_url: row.get(9)?,
        playtime_seconds: row.get::<_, i64>(10)? as u64,
        last_played: row.get(11)?,
        date_added: row.get(12)?,
        developer: row.get(13)?,
        tags,
        achievement_count: row.get::<_, i64>(15)? as u64,
        achievements_unlocked: row.get::<_, i64>(16)? as u64,
    })
}

#[tauri::command]
pub fn get_all_games(state: State<DbState>) -> Vec<Game> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT id, title, description, genre, cover_url, banner_url, screenshots,
             exe_path, install_dir, bunnycdn_download_url, playtime_seconds, last_played,
             date_added, developer, tags, achievement_count, achievements_unlocked
             FROM games ORDER BY title ASC",
        )
        .unwrap();

    stmt.query_map([], row_to_game)
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
}

#[tauri::command]
pub fn get_game_by_id(state: State<DbState>, id: String) -> Option<Game> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT id, title, description, genre, cover_url, banner_url, screenshots,
             exe_path, install_dir, bunnycdn_download_url, playtime_seconds, last_played,
             date_added, developer, tags, achievement_count, achievements_unlocked
             FROM games WHERE id = ?1",
        )
        .ok()?;

    stmt.query_row([&id], row_to_game).ok()
}

#[tauri::command]
pub fn add_game(state: State<DbState>, game: Game) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let genre = serde_json::to_string(&game.genre).unwrap_or_default();
    let screenshots = serde_json::to_string(&game.screenshots).unwrap_or_default();
    let tags = serde_json::to_string(&game.tags).unwrap_or_default();

    conn.execute(
        "INSERT INTO games (id, title, description, genre, cover_url, banner_url, screenshots,
         exe_path, install_dir, bunnycdn_download_url, playtime_seconds, last_played,
         date_added, developer, tags, achievement_count, achievements_unlocked)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)",
        rusqlite::params![
            game.id,
            game.title,
            game.description,
            genre,
            game.cover_url,
            game.banner_url,
            screenshots,
            game.exe_path,
            game.install_dir,
            game.bunnycdn_download_url,
            game.playtime_seconds as i64,
            game.last_played,
            game.date_added,
            game.developer,
            tags,
            game.achievement_count as i64,
            game.achievements_unlocked as i64,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_game(state: State<DbState>, game: Game) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let genre = serde_json::to_string(&game.genre).unwrap_or_default();
    let screenshots = serde_json::to_string(&game.screenshots).unwrap_or_default();
    let tags = serde_json::to_string(&game.tags).unwrap_or_default();

    conn.execute(
        "UPDATE games SET title=?1, description=?2, genre=?3, cover_url=?4, banner_url=?5,
         screenshots=?6, exe_path=?7, install_dir=?8, bunnycdn_download_url=?9,
         playtime_seconds=?10, last_played=?11, developer=?12, tags=?13,
         achievement_count=?14, achievements_unlocked=?15
         WHERE id=?16",
        rusqlite::params![
            game.title,
            game.description,
            genre,
            game.cover_url,
            game.banner_url,
            screenshots,
            game.exe_path,
            game.install_dir,
            game.bunnycdn_download_url,
            game.playtime_seconds as i64,
            game.last_played,
            game.developer,
            tags,
            game.achievement_count as i64,
            game.achievements_unlocked as i64,
            game.id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn remove_game(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM games WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM achievements WHERE game_id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
