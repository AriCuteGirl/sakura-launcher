use crate::models::catalog::{Catalog, CatalogGame};
use s3::bucket::Bucket;
use s3::creds::Credentials;
use s3::region::Region;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Thread-safe S3 client wrapper
#[derive(Clone)]
pub struct S3Client(pub Arc<Mutex<Option<Box<Bucket>>>>);

impl S3Client {
    pub fn new() -> Self {
        S3Client(Arc::new(Mutex::new(None)))
    }

    /// Initialize the S3 client from settings. Returns true if configured.
    pub async fn configure(
        &self,
        endpoint: &str,
        region: &str,
        bucket: &str,
        access_key: &str,
        secret_key: &str,
    ) -> Result<(), String> {
        let clean_endpoint = endpoint.trim_end_matches('/');
        let custom_region = Region::Custom {
            region: region.to_string(),
            endpoint: clean_endpoint.to_string(),
        };

        let credentials = Credentials::new(
            Some(access_key),
            Some(secret_key),
            None, None, None,
        ).map_err(|e| format!("S3 credentials error: {e}"))?;

        let b = Bucket::new(
            bucket,
            custom_region,
            credentials,
        )
        .map_err(|e| format!("S3 bucket error: {e}"))?
        .with_path_style();

        let mut guard = self.0.lock().await;
        *guard = Some(b);
        Ok(())
    }

    /// Check if S3 is configured
    pub async fn is_configured(&self) -> bool {
        self.0.lock().await.is_some()
    }
}

/// Strip scene tags and clean up game name (same logic as catalog.rs)
fn strip_scene_tags(name: &str) -> String {
    let tags = [
        "steamrip", "gog", "rip", "multi", "multilingual",
        "razor1911", "fitgirl", "chronos", "darksiders",
        "plaza", "codex", "reloaded", "flt", "skidrow",
        "hoodlum", "cpy", "simplex", "prophet", "fairlight",
        "tenoke", "rune",
    ];
    let mut result = name.to_string();
    for tag in &tags {
        let patterns = [
            format!(" {tag}"),
            format!("-{tag}"),
            format!("[{tag}]"),
            format!("({tag})"),
            format!(".{tag}"),
        ];
        let result_lower = result.to_lowercase();
        for pat in &patterns {
            if result_lower.contains(pat) {
                if let Some(pos) = result_lower.find(pat) {
                    result.replace_range(pos..pos + pat.len(), "");
                }
            }
        }
    }

    let tlds = [".com", ".net", ".org", ".io", ".co", ".uk", ".game", ".exe", ".v1", ".v2"];
    for tld in &tlds {
        let lower = result.to_lowercase();
        if lower.ends_with(tld) {
            let len = result.len();
            result.truncate(len - tld.len());
        }
    }

    result.trim().to_string()
}

fn guess_title_and_tags(name: &str) -> (String, Vec<String>) {
    let stem = name
        .trim_end_matches(".zip")
        .trim_end_matches(".ZIP")
        .trim_end_matches(".7z")
        .trim_end_matches(".rar")
        .trim_end_matches(".RAR");

    let cleaned = strip_scene_tags(stem);

    let title: String = cleaned
        .split_whitespace()
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
        .to_string();

    let mut tags = Vec::new();
    let lower = title.to_lowercase();
    if lower.contains("linux") { tags.push("linux".to_string()); }
    if lower.contains("windows") { tags.push("windows".to_string()); }
    if lower.contains("portable") { tags.push("portable".to_string()); }
    if lower.contains("demo") { tags.push("demo".to_string()); }

    (title, tags)
}

/// Fetch catalog from Filen.io S3 — lists all .zip files in the bucket's root /games/ prefix
#[tauri::command]
pub async fn fetch_s3_catalog(
    s3_state: tauri::State<'_, S3Client>,
) -> Result<Catalog, String> {
    let guard = s3_state.0.lock().await;
    let bucket = guard.as_ref().ok_or_else(|| {
        "S3 not configured. Set Filen.io S3 credentials in settings.".to_string()
    })?;

    // List objects — try root, then games/ prefix
    let mut all_keys: Vec<(String, u64)> = Vec::new();

    for prefix in &["", "games/", "Games/"] {
        let results = bucket
            .list(prefix.to_string(), Some("/".to_string()))
            .await
            .map_err(|e| format!("S3 list error: {e}"))?;

        for result in &results {
            for object in &result.contents {
                let key = &object.key;
                let lower = key.to_lowercase();
                if lower.ends_with(".zip") || lower.ends_with(".7z") || lower.ends_with(".rar") {
                    all_keys.push((key.clone(), object.size));
                }
            }
        }
    }

    if all_keys.is_empty() {
        return Err("No game archives found in S3 bucket. Upload .zip files to the root or /games/ folder.".to_string());
    }

    let mut games: Vec<CatalogGame> = Vec::new();
    for (key, size) in all_keys {
        let (title, tags) = guess_title_and_tags(&key);
        let id = title.to_lowercase().replace(' ', "-");

        // Generate presigned download URL (valid for 24h)
        let download_url = bucket
            .presign_get(&key, 86400, None)
            .await
            .map_err(|e| format!("S3 presign error: {e}"))?;

        games.push(CatalogGame {
            id,
            title,
            description: String::new(),
            genre: Vec::new(),
            cover_url: String::new(),
            banner_url: String::new(),
            screenshots: Vec::new(),
            download_url,
            developer: String::new(),
            tags,
            size_bytes: Some(size),
            version: None,
        });
    }

    Ok(Catalog { games })
}

/// Generate a presigned S3 download URL for a game
#[tauri::command]
pub async fn generate_s3_download_url(
    s3_state: tauri::State<'_, S3Client>,
    key: String,
) -> Result<String, String> {
    let guard = s3_state.0.lock().await;
    let bucket = guard.as_ref().ok_or_else(|| {
        "S3 not configured.".to_string()
    })?;

    bucket
        .presign_get(&key, 86400, None)
        .await
        .map_err(|e| format!("S3 presign error: {e}"))
}

/// Configure S3 from settings — call this on app startup
#[tauri::command]
pub async fn configure_s3(
    s3_state: tauri::State<'_, S3Client>,
    endpoint: String,
    region: String,
    bucket: String,
    access_key: String,
    secret_key: String,
) -> Result<(), String> {
    s3_state.configure(&endpoint, &region, &bucket, &access_key, &secret_key).await
}

/// Check if S3 is configured and ready
#[tauri::command]
pub async fn s3_status(
    s3_state: tauri::State<'_, S3Client>,
) -> Result<bool, String> {
    Ok(s3_state.is_configured().await)
}
