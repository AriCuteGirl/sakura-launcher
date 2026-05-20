use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub install_dir: String,
    pub bunnycdn_base_url: String,
    pub bunnycdn_storage_zone: String,
    pub bunnycdn_api_key: String,
    pub theme: String,
    pub launch_on_startup: bool,
    pub language: String,
    pub goldberg_path: Option<String>,
    pub rawg_api_key: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            install_dir: String::new(),
            bunnycdn_base_url: String::new(),
            bunnycdn_storage_zone: String::new(),
            bunnycdn_api_key: String::new(),
            theme: "dark".to_string(),
            launch_on_startup: false,
            language: "en".to_string(),
            goldberg_path: None,
            rawg_api_key: None,
        }
    }
}

fn settings_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("sakura_settings.json"))
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app)?;
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_settings(app: tauri::AppHandle) -> AppSettings {
    match settings_path(&app) {
        Ok(path) if path.exists() => {
            match std::fs::read_to_string(&path) {
                Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
                Err(_) => AppSettings::default(),
            }
        }
        _ => AppSettings::default(),
    }
}
