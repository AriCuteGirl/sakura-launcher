use crate::models::game::Game;
use crate::DbState;
use chrono::Utc;
use std::process::Command;
use tauri::State;
use uuid::Uuid;

// Common game executable extensions/names to look for
const EXE_EXTENSIONS: &[&str] = &["exe", "sh", "appimage", "bin", "x86_64", "x86"];
const EXE_EXCLUDE: &[&str] = &[
    "unins", "uninstall", "setup", "install", "redist", "vcredist",
    "directx", "crash", "report", "launcher_old",
];
const ARCHIVE_EXTS: &[&str] = &["zip", "rar", "7z"];

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

fn dir_to_title(name: &str) -> String {
    let cleaned = name
        .replace(['-', '_'], " ")
        .replace(['(', ')', '[', ']'], "");

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

fn extract_archive(archive_path: &str, out_dir: &str) -> Result<(), String> {
    let path = std::path::Path::new(archive_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "zip" => extract_zip(archive_path, out_dir),
        "rar" => extract_rar(archive_path, out_dir),
        "7z" => extract_7z(archive_path, out_dir),
        _ => Err(format!("Unsupported archive format: .{}", ext)),
    }
}

fn extract_zip(zip_path: &str, out_dir: &str) -> Result<(), String> {
    let file = std::fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    // Check if all files are inside a single root dir
    let root_dir = find_common_root(&archive);

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let entry_name = entry.name().to_string();

        // If there's a common root, strip it
        let rel_path = if let Some(ref root) = root_dir {
            entry_name.strip_prefix(root).unwrap_or(&entry_name)
        } else {
            &entry_name
        };

        let outpath = std::path::Path::new(out_dir).join(rel_path);

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

fn find_common_root(archive: &zip::ZipArchive<std::fs::File>) -> Option<String> {
    let names: Vec<&str> = archive.file_names().collect();
    if names.is_empty() {
        return None;
    }

    // If any file is at root level (no /), there's no single root
    let all_have_root = names.iter().all(|n| n.contains('/'));
    if !all_have_root {
        return None;
    }

    // Get the first directory component of each path
    let roots: std::collections::HashSet<&str> = names
        .iter()
        .filter_map(|n| n.split('/').next())
        .collect();

    if roots.len() == 1 {
        roots.into_iter().next().map(|r| format!("{}/", r))
    } else {
        None
    }
}

fn extract_rar(rar_path: &str, out_dir: &str) -> Result<(), String> {
    // Try system unrar, then unrar-free
    for cmd in &["unrar", "unrar-free"] {
        if let Ok(output) = Command::new(cmd)
            .args(["x", "-o+", rar_path, out_dir])
            .output()
        {
            if output.status.success() {
                return Ok(());
            }
            // Failed but command exists — don't try another
            return Err(format!("{} failed: {}", cmd, String::from_utf8_lossy(&output.stderr)));
        }
    }
    Err("No RAR extractor found (install unrar)".to_string())
}

fn extract_7z(seven_z_path: &str, out_dir: &str) -> Result<(), String> {
    for cmd in &["7z", "7za", "7zr"] {
        if let Ok(output) = Command::new(cmd)
            .args(["x", seven_z_path, format!("-o{}", out_dir).as_str(), "-aoa"])
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

#[tauri::command]
pub fn scan_games(state: State<DbState>, scan_dir: String) -> Result<Vec<Game>, String> {
    let base = std::path::Path::new(&scan_dir);
    if !base.exists() || !base.is_dir() {
        return Err(format!("Directory does not exist: {}", scan_dir));
    }

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
        let name = entry.file_name().to_string_lossy().to_string();
        let path_str = path.to_string_lossy().to_string();

        if path.is_dir() {
            // --- Scan existing game folder ---
            if existing_dirs.iter().any(|d| d == &path_str) {
                continue;
            }

            let exe_path = find_main_exe(&path).unwrap_or_default();

            if !exe_path.is_empty() && existing_exes.iter().any(|e| e == &exe_path) {
                continue;
            }

            let title = dir_to_title(&name);
            if title.is_empty() {
                continue;
            }

            new_games.push(Game {
                id: Uuid::new_v4().to_string(),
                title,
                description: String::new(),
                genre: Vec::new(),
                cover_url: String::new(),
                banner_url: String::new(),
                screenshots: Vec::new(),
                exe_path,
                install_dir: path_str,
                bunnycdn_download_url: None,
                playtime_seconds: 0,
                last_played: None,
                date_added: now.clone(),
                developer: String::new(),
                tags: Vec::new(),
                achievement_count: 0,
                achievements_unlocked: 0,
            });
        } else if path.is_file() {
            // --- Scan archive file (.zip, .rar, .7z) ---
            let ext = path.extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase())
                .unwrap_or_default();

            if !ARCHIVE_EXTS.contains(&ext.as_str()) {
                continue;
            }

            // Derive title from archive name
            let stem = path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or(&name);
            let title = dir_to_title(stem);
            if title.is_empty() {
                continue;
            }

            // Extract to a folder named after the archive
            let extract_dir = format!("{}/{}", scan_dir, stem);

            // Skip if already extracted
            if existing_dirs.iter().any(|d| d == &extract_dir) {
                continue;
            }

            // Create and extract
            std::fs::create_dir_all(&extract_dir).ok();
            if let Err(e) = extract_archive(&path_str, &extract_dir) {
                eprintln!("Failed to extract {}: {}", name, e);
                // Still add as a game with the archive as a marker
                // so the user can re-extract later
            }

            // Find the game exe in extracted folder
            let extract_path = std::path::Path::new(&extract_dir);
            let exe_path = find_main_exe(extract_path).unwrap_or_default();

            if !exe_path.is_empty() && existing_exes.iter().any(|e| e == &exe_path) {
                continue;
            }

            new_games.push(Game {
                id: Uuid::new_v4().to_string(),
                title,
                description: String::new(),
                genre: Vec::new(),
                cover_url: String::new(),
                banner_url: String::new(),
                screenshots: Vec::new(),
                exe_path,
                install_dir: extract_dir,
                bunnycdn_download_url: None,
                playtime_seconds: 0,
                last_played: None,
                date_added: now.clone(),
                developer: String::new(),
                tags: Vec::new(),
                achievement_count: 0,
                achievements_unlocked: 0,
            });
        }
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
