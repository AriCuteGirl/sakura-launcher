use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogGame {
    pub id: String,
    pub title: String,
    pub description: String,
    pub genre: Vec<String>,
    pub cover_url: String,
    pub banner_url: String,
    pub screenshots: Vec<String>,
    pub download_url: String,
    pub developer: String,
    pub tags: Vec<String>,
    pub size_bytes: Option<u64>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Catalog {
    pub games: Vec<CatalogGame>,
}
