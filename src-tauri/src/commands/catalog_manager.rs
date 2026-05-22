use crate::models::catalog::CatalogGame;
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use std::path::PathBuf;
use tauri::Manager;

/// Local catalog manager — lets the user build and publish a game catalog
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogManager {
    pub games: Vec<CatalogGame>,
}

impl CatalogManager {
    fn path() -> PathBuf {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let dir = format!("{}/.local/share/sakura-launcher", home);
        std::fs::create_dir_all(&dir).ok();
        PathBuf::from(dir).join("catalog_manager.json")
    }

    pub fn load() -> Self {
        let path = Self::path();
        if path.exists() {
            if let Ok(json) = std::fs::read_to_string(&path) {
                if let Ok(cm) = serde_json::from_str(&json) {
                    return cm;
                }
            }
        }
        Self { games: Vec::new() }
    }

    fn save(&self) -> Result<(), String> {
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(Self::path(), json).map_err(|e| e.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubConfig {
    pub token: String,
    pub owner: String,
    pub repo: String,
    pub path: String,
    pub branch: String,
}

impl Default for GitHubConfig {
    fn default() -> Self {
        Self {
            token: String::new(),
            owner: String::new(),
            repo: String::new(),
            path: "catalog.json".to_string(),
            branch: "main".to_string(),
        }
    }
}

// ── Tauri Commands ──────────────────────────────────────────

#[tauri::command]
pub fn load_catalog_manager() -> Vec<CatalogGame> {
    CatalogManager::load().games
}

#[tauri::command]
pub fn add_catalog_game(game: CatalogGame) -> Result<(), String> {
    let mut cm = CatalogManager::load();
    // Replace if exists, otherwise add
    if let Some(pos) = cm.games.iter().position(|g| g.id == game.id) {
        cm.games[pos] = game;
    } else {
        cm.games.push(game);
    }
    cm.save()
}

#[tauri::command]
pub fn remove_catalog_game(id: String) -> Result<(), String> {
    let mut cm = CatalogManager::load();
    cm.games.retain(|g| g.id != id);
    cm.save()
}

#[tauri::command]
pub async fn publish_catalog(
    token: String,
    owner: String,
    repo: String,
    path: String,
    branch: String,
    commit_message: Option<String>,
) -> Result<String, String> {
    if token.is_empty() || owner.is_empty() || repo.is_empty() {
        return Err("GitHub token, owner, and repo are required.".to_string());
    }

    let cm = CatalogManager::load();
    let catalog = crate::models::catalog::Catalog { games: cm.games };
    let content = serde_json::to_string_pretty(&catalog).map_err(|e| e.to_string())?;

    let file_path = if path.is_empty() { "catalog.json".to_string() } else { path };
    let branch_name = if branch.is_empty() { "main".to_string() } else { branch };
    let msg = commit_message.unwrap_or_else(|| format!("Update game catalog — {} games", catalog.games.len()));

    // GitHub API: get the current file SHA if it exists
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let get_url = format!(
        "https://api.github.com/repos/{}/{}/contents/{}?ref={}",
        owner, repo, file_path, branch_name
    );

    let existing_sha = {
        let resp = client
            .get(&get_url)
            .header("User-Agent", "sakura-launcher")
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/vnd.github.v3+json")
            .send()
            .await
            .map_err(|e| format!("GitHub API error: {e}"))?;

        if resp.status().is_success() {
            let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            body.get("sha").and_then(|s| s.as_str()).map(|s| s.to_string())
        } else {
            None // File doesn't exist yet
        }
    };

    // Encode content as base64
    use base64::Engine;
    let encoded = base64::engine::general_purpose::STANDARD.encode(content.as_bytes());

    // Create or update the file
    let put_url = format!(
        "https://api.github.com/repos/{}/{}/contents/{}",
        owner, repo, file_path
    );

    let mut body = serde_json::json!({
        "message": msg,
        "content": encoded,
        "branch": branch_name,
    });

    if let Some(sha) = existing_sha {
        body["sha"] = serde_json::json!(sha);
    }

    let resp = client
        .put(&put_url)
        .header("User-Agent", "sakura-launcher")
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github.v3+json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("GitHub push error: {e}"))?;

    if resp.status().is_success() || resp.status().as_u16() == 201 {
        // Return the GitHub Pages URL
        let pages_url = if owner.contains('/') {
            // Full repo URL
            format!("https://raw.githubusercontent.com/{}/{}/refs/heads/{}", owner, repo, branch_name)
        } else {
            format!("https://raw.githubusercontent.com/{}/{}/refs/heads/{}", owner, repo, branch_name)
        };
        
        // GitHub Pages URL (if Pages is enabled)
        let github_pages = format!("https://{}.github.io/{}/{}", owner, repo, file_path);
        
        Ok(format!(
            "✅ Catalog published!\n\nGitHub Pages:\n{}\n\nRaw URL:\n{}/{}",
            github_pages, pages_url, file_path
        ))
    } else {
        let status = resp.status();
        let error_text = resp.text().await.unwrap_or_default();
        Err(format!("GitHub API returned HTTP {}: {}", status, error_text))
    }
}

/// Check if admin password has been set
#[tauri::command]
pub fn is_admin_password_set(app: tauri::AppHandle) -> bool {
    let path = app.path().app_config_dir().ok().map(|d| d.join("sakura_settings.json"));
    if let Some(p) = path {
        if p.exists() {
            if let Ok(json) = std::fs::read_to_string(&p) {
                if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&json) {
                    return settings.get("admin_password_hash").and_then(|v| v.as_str()).map(|s| !s.is_empty()).unwrap_or(false);
                }
            }
        }
    }
    false
}

/// Verify admin password against stored SHA-256 hash
#[tauri::command]
pub fn verify_admin_password(app: tauri::AppHandle, password: String) -> bool {
    let path = app.path().app_config_dir().ok().map(|d| d.join("sakura_settings.json"));
    if let Some(p) = path {
        if p.exists() {
            if let Ok(json) = std::fs::read_to_string(&p) {
                if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&json) {
                    if let Some(stored_hash) = settings.get("admin_password_hash").and_then(|v| v.as_str()) {
                        let hash = Sha256::digest(password.as_bytes());
                        let input_hash = format!("{:x}", hash);
                        return input_hash == stored_hash;
                    }
                }
            }
        }
    }
    false
}
