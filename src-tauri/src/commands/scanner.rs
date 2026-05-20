use crate::models::game::Game;
use crate::DbState;
use chrono::Utc;
use tauri::State;
use uuid::Uuid;

// Common game executable extensions/names to look for
const EXE_EXTENSIONS: &[&str] = &["exe", "sh", "appimage", "bin", "x86_64", "x86"];
const EXE_EXCLUDE: &[&str] = &[
    "unins", "uninstall", "setup", "install", "redist", "vcredist",
    "directx", "crash", "report", "launcher_old",
];

fn is_game_exe(name: &str) -> bool {
    let lower = name.to_lowercase();
    // Check it has a recognized extension or no extension (Linux binaries)
    let has_ext = EXE_EXTENSIONS.iter().any(|ext| lower.ends_with(&format!(".{}", ext)));
    let no_ext_executable = !lower.contains('.');
    if !has_ext && !no_ext_executable {
        return false;
    }
    // Exclude known non-game executables
    !EXE_EXCLUDE.iter().any(|ex| lower.contains(ex))
}

fn find_main_exe(dir: &std::path::Path) -> Option<String> {
    // Walk up to 2 levels deep, find the most likely game executable
    let mut candidates: Vec<(usize, String)> = Vec::new();

    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if path.is_file() && is_game_exe(&name) {
                // Prefer executables that match the parent folder name
                let folder_name = dir
                    .file_name()
                    .map(|n| n.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                let score = if name.to_lowercase().contains(&folder_name) { 10 } else { 1 };
                candidates.push((score, path.to_string_lossy().to_string()));
            } else if path.is_dir() {
                // One level deeper
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

fn dir_to_title(name: &str) -> String {
    // Convert folder name to readable title
    // e.g. "dark_souls_3" -> "Dark Souls 3", "MyGame-v1.2" -> "MyGame"
    let cleaned = name
        .replace(['-', '_'], " ")
        .replace(['(', ')', '[', ']'], "");

    // Remove version patterns like v1.2, v2.0.1
    let re_words: Vec<&str> = cleaned
        .split_whitespace()
        .filter(|w| {
            let lower = w.to_lowercase();
            !lower.starts_with('v') || !lower[1..].chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false)
        })
        .collect();

    re_words
        .iter()
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

#[tauri::command]
pub fn scan_games(state: State<DbState>, scan_dir: String) -> Result<Vec<Game>, String> {
    let base = std::path::Path::new(&scan_dir);
    if !base.exists() || !base.is_dir() {
        return Err(format!("Directory does not exist: {}", scan_dir));
    }

    // Get existing game install dirs so we don't duplicate
    let existing_dirs: Vec<String> = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT install_dir FROM games")
            .map_err(|e| e.to_string())?;
        let rows: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        rows
    };

    let existing_exes: Vec<String> = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT exe_path FROM games WHERE exe_path != ''")
            .map_err(|e| e.to_string())?;
        let rows: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        rows
    };

    let mut new_games: Vec<Game> = Vec::new();
    let now = Utc::now().to_rfc3339();

    let entries = std::fs::read_dir(base).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let install_dir = path.to_string_lossy().to_string();

        // Skip already-imported dirs
        if existing_dirs.iter().any(|d| d == &install_dir) {
            continue;
        }

        // Try to find main executable
        let exe_path = find_main_exe(&path).unwrap_or_default();

        // Skip if this exe is already tracked
        if !exe_path.is_empty() && existing_exes.iter().any(|e| e == &exe_path) {
            continue;
        }

        let folder_name = entry
            .file_name()
            .to_string_lossy()
            .to_string();
        let title = dir_to_title(&folder_name);

        if title.is_empty() {
            continue;
        }

        let game = Game {
            id: Uuid::new_v4().to_string(),
            title,
            description: String::new(),
            genre: Vec::new(),
            cover_url: String::new(),
            banner_url: String::new(),
            screenshots: Vec::new(),
            exe_path,
            install_dir,
            bunnycdn_download_url: None,
            playtime_seconds: 0,
            last_played: None,
            date_added: now.clone(),
            developer: String::new(),
            tags: Vec::new(),
            achievement_count: 0,
            achievements_unlocked: 0,
        };

        new_games.push(game);
    }

    // Auto-save all found games to DB
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    for game in &new_games {
        let genre = serde_json::to_string(&game.genre).unwrap_or_default();
        let screenshots = serde_json::to_string(&game.screenshots).unwrap_or_default();
        let tags = serde_json::to_string(&game.tags).unwrap_or_default();

        conn.execute(
            "INSERT OR IGNORE INTO games
             (id, title, description, genre, cover_url, banner_url, screenshots,
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
        .ok();
    }

    Ok(new_games)
}
