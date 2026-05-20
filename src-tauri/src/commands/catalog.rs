use crate::commands::settings::AppSettings;
use crate::models::catalog::{Catalog, CatalogGame};
use serde::Deserialize;
use tauri::Manager;

#[derive(Deserialize)]
struct BunnyStorageItem {
    #[serde(rename = "ObjectName")]
    object_name: String,
    #[serde(rename = "IsDirectory")]
    is_directory: bool,
    #[serde(rename = "Length")]
    length: u64,
}

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
    if lower.contains("linux") {
        tags.push("linux".to_string());
    }
    if lower.contains("windows") {
        tags.push("windows".to_string());
    }
    if lower.contains("portable") {
        tags.push("portable".to_string());
    }
    if lower.contains("demo") {
        tags.push("demo".to_string());
    }

    (title, tags)
}

fn read_settings(app: &tauri::AppHandle) -> AppSettings {
    let dir = app.path().app_config_dir().ok();
    if let Some(d) = dir {
        let path = d.join("sakura_settings.json");
        if path.exists() {
            if let Ok(json) = std::fs::read_to_string(&path) {
                return serde_json::from_str(&json).unwrap_or_default();
            }
        }
    }
    AppSettings::default()
}

#[tauri::command]
pub async fn fetch_catalog(app: tauri::AppHandle, base_url: String) -> Result<Catalog, String> {
    let settings = read_settings(&app);

    let cdn_url = if base_url.trim().is_empty() {
        settings.bunnycdn_base_url.clone()
    } else {
        base_url
    };

    let storage_zone = settings.bunnycdn_storage_zone.clone();
    let api_key = settings.bunnycdn_api_key.clone();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    // Try catalog.json first
    if !cdn_url.trim().is_empty() {
        let catalog_url = format!("{}/catalog.json", cdn_url.trim_end_matches('/'));
        if let Ok(resp) = client.get(&catalog_url).send().await {
            if resp.status().is_success() {
                if let Ok(catalog) = resp.json::<Catalog>().await {
                    return Ok(catalog);
                }
            }
        }
    }

    // Fall back to Storage API auto-discovery
    if storage_zone.is_empty() || api_key.is_empty() {
        return Err(
            "Configure Storage Zone Name and API Key in Settings.\n\n\
             BunnyCDN Dashboard → Storage → {zone} → FTP & API Access"
                .to_string(),
        );
    }

    let api_url = format!(
        "https://storage.bunnycdn.com/{}/",
        storage_zone.trim_end_matches('/')
    );

    let mut zip_urls: Vec<(String, String, u64)> = Vec::new();

    for path in &["", "games/", "Games/"] {
        let list_url = format!("{}{}", api_url, path);
        let resp = match client
            .get(&list_url)
            .header("AccessKey", api_key.to_string())
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => r,
            _ => continue,
        };

        let items: Vec<BunnyStorageItem> = match resp.json().await {
            Ok(i) => i,
            _ => continue,
        };

        for item in items {
            if !item.is_directory {
                let name_lower = item.object_name.to_lowercase();
                if name_lower.ends_with(".zip") || name_lower.ends_with(".7z") || name_lower.ends_with(".rar") {
                    let dl_url = if cdn_url.trim().is_empty() {
                        format!("{}{}{}", api_url, path, item.object_name)
                    } else {
                        format!(
                            "{}/{}{}",
                            cdn_url.trim_end_matches('/'),
                            path,
                            item.object_name
                        )
                    };
                    zip_urls.push((item.object_name.clone(), dl_url, item.length));
                }
            }
        }
    }

    if zip_urls.is_empty() {
        let msg = if cdn_url.is_empty() {
            format!(
                "No .zip files found in storage zone '{}'.\n\
                 Upload game zips to the root or /games/ folder.",
                storage_zone
            )
        } else {
            format!(
                "No .zip files found.\nStorage zone: {}\nCDN: {}",
                storage_zone, cdn_url
            )
        };
        return Err(msg);
    }

    let mut games: Vec<CatalogGame> = Vec::new();
    for (name, dl_url, size) in zip_urls {
        let (title, tags) = guess_title_and_tags(&name);
        let id = title.to_lowercase().replace(' ', "-");
        let mut cover_url = String::new();
        let mut banner_url = String::new();

        if !cdn_url.trim().is_empty() {
            let base = cdn_url.trim_end_matches('/');
            cover_url = format!("{}/covers/{}.jpg", base, id);
            banner_url = format!("{}/banners/{}.jpg", base, id);
        }

        games.push(CatalogGame {
            id,
            title,
            description: String::new(),
            genre: Vec::new(),
            cover_url,
            banner_url,
            screenshots: Vec::new(),
            download_url: dl_url,
            developer: String::new(),
            tags,
            size_bytes: Some(size),
            version: None,
        });
    }

    Ok(Catalog { games })
}
