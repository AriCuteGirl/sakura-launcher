use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub id: String,
    pub title: String,
    pub description: String,
    pub genre: Vec<String>,
    pub cover_url: String,
    pub banner_url: String,
    pub screenshots: Vec<String>,
    pub exe_path: String,
    pub install_dir: String,
    pub bunnycdn_download_url: Option<String>,
    pub playtime_seconds: u64,
    pub last_played: Option<String>,
    pub date_added: String,
    pub developer: String,
    pub tags: Vec<String>,
    pub achievement_count: u64,
    pub achievements_unlocked: u64,
}
