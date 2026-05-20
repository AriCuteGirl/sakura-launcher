use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawgGameInfo {
    pub rawg_id: Option<i64>,
    pub description: String,
    pub genres: Vec<String>,
    pub cover_url: Option<String>,
    pub release_date: Option<String>,
    pub rating: Option<f64>,
    pub metacritic: Option<i64>,
    pub platforms: Vec<String>,
}

#[tauri::command]
pub async fn fetch_game_metadata(
    title: String,
    rawg_api_key: String,
) -> Result<RawgGameInfo, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {e}"))?;

    let url = format!(
        "https://api.rawg.io/api/games?key={}&search={}&page_size=1",
        rawg_api_key, title
    );

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("RAWG API request failed: {e}"))?;

    let status = resp.status();
    if !status.is_success() {
        return Err(format!("RAWG API returned HTTP {status}"));
    }

    let body_str = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read RAWG response body: {e}"))?;

    let body: serde_json::Value =
        serde_json::from_str(&body_str).map_err(|e| format!("Failed to parse RAWG response: {e}"))?;

    let results = body
        .get("results")
        .and_then(|r| r.as_array())
        .ok_or_else(|| format!("RAWG API returned no results array. Body preview: {}", &body_str[..200.min(body_str.len())]))?;

    let game = match results.first() {
        Some(g) => g,
        None => {
            return Ok(RawgGameInfo {
                rawg_id: None,
                description: String::new(),
                genres: Vec::new(),
                cover_url: None,
                release_date: None,
                rating: None,
                metacritic: None,
                platforms: Vec::new(),
            });
        }
    };

    let rawg_id = game.get("id").and_then(|v| v.as_i64());
    let description = game
        .get("description_raw")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let genres: Vec<String> = game
        .get("genres")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|g| g.get("name").and_then(|n| n.as_str()).map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let cover_url = game
        .get("background_image")
        .and_then(|v| v.as_str())
        .map(String::from);

    let release_date = game
        .get("released")
        .and_then(|v| v.as_str())
        .map(String::from);

    let rating = game.get("rating").and_then(|v| v.as_f64());
    let metacritic = game.get("metacritic").and_then(|v| v.as_i64());

    let platforms: Vec<String> = game
        .get("platforms")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|p| {
                    p.get("platform")
                        .and_then(|plat| plat.get("name").and_then(|n| n.as_str()))
                        .map(String::from)
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(RawgGameInfo {
        rawg_id,
        description,
        genres,
        cover_url,
        release_date,
        rating,
        metacritic,
        platforms,
    })
}
