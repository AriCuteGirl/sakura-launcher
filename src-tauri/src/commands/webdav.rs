use crate::models::catalog::{Catalog, CatalogGame};
use reqwest::Method;
use std::collections::HashMap;

/// Fetch catalog from WebDAV — lists all files via PROPFIND and builds a game catalog
#[tauri::command]
pub async fn fetch_webdav_catalog(
    webdav_url: String,
    username: Option<String>,
    password: Option<String>,
) -> Result<Catalog, String> {
    if webdav_url.trim().is_empty() {
        return Err("WebDAV URL is not configured. Go to Settings → WebDAV.".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .danger_accept_invalid_certs(true) // local gateways often use self-signed
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let base_url = webdav_url.trim_end_matches('/').to_string();

    // Try listing with PROPFIND — try root, then /games/
    let mut all_files: Vec<(String, u64)> = Vec::new();
    let paths_to_try = vec!["", "/games", "/Games"];

    for subpath in &paths_to_try {
        let list_url = format!("{}{}", base_url, subpath);
        let method = Method::from_bytes(b"PROPFIND").unwrap_or(Method::GET);
        let mut req = client
            .request(method, &list_url)
            .header("Depth", "1");

        if let Some(ref u) = username {
            if let Some(ref p) = password {
                req = req.basic_auth(u, Some(p));
            }
        }

        let resp = match req.send().await {
            Ok(r) if r.status().is_success() => r,
            Ok(r) if r.status().as_u16() == 207 => r, // Multi-Status
            _ => continue,
        };

        let body = resp.text().await.map_err(|e| format!("Failed to read WebDAV response: {e}"))?;

        // Parse the XML multistat response
        let entries = parse_propfind_response(&body);
        for (href, size) in entries {
            let lower = href.to_lowercase();
            // Skip directories and non-archive files
            if href.ends_with('/') || href.ends_with(".zip") == false && href.ends_with(".7z") == false && href.ends_with(".rar") == false {
                continue;
            }
            // Only add archives
            if lower.ends_with(".zip") || lower.ends_with(".7z") || lower.ends_with(".rar") {
                // Build full URL
                let full_url = if href.starts_with("http") {
                    href.clone()
                } else {
                    let base = base_url.trim_end_matches('/');
                    let path = href.trim_start_matches('/');
                    format!("{}/{}", base, path)
                };
                all_files.push((full_url, size));
            }
        }

        if !all_files.is_empty() {
            break; // Found files, no need to try other paths
        }
    }

    if all_files.is_empty() {
        return Err(
            "No game archives found on WebDAV. Upload .zip files to the root or /games/ folder."
                .to_string(),
        );
    }

    // De-duplicate by filename
    let mut seen = std::collections::HashSet::new();
    let unique_files: Vec<(String, u64)> = all_files
        .into_iter()
        .filter(|(url, _)| {
            let name = url.rsplit('/').next().unwrap_or(url);
            seen.insert(name.to_string())
        })
        .collect();

    let mut games: Vec<CatalogGame> = Vec::new();
    for (download_url, size) in unique_files {
        let filename = download_url.rsplit('/').next().unwrap_or(&download_url);
        let (title, tags) = guess_title_and_tags(filename);
        let id = title.to_lowercase().replace(' ', "-");

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

/// Parse WebDAV PROPFIND XML response to extract file names and sizes
fn parse_propfind_response(xml: &str) -> Vec<(String, u64)> {
    let mut entries = Vec::new();

    // Simple XML parsing — find all <D:response> or <response> blocks
    // Handle both namespace-prefixed and bare tags
    let response_patterns = ["<D:response>", "<d:response>", "<response>"];
    let response_end = "</D:response></d:response></response>";

    let mut pos = 0;
    while pos < xml.len() {
        // Find next <response
        let start = match find_any(xml, &response_patterns, pos) {
            Some(s) => s,
            None => break,
        };

        // Find </D:response> or </d:response> or </response>
        let end = match xml[start..].find("</") {
            Some(e) => {
                let close_start = start + e;
                match xml[close_start..].find('>') {
                    Some(gt) => close_start + gt + 1,
                    None => break,
                }
            }
            None => break,
        };

        let block = &xml[start..end];
        pos = end;

        // Extract href
        let href = extract_xml_value(block, "href");
        let href = href.unwrap_or_default();

        // Extract size (getcontentlength)
        let size = extract_xml_value(block, "getcontentlength")
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);

        if !href.is_empty() {
            entries.push((href, size));
        }
    }

    // Fallback: if no entries found with namespace parsing, try bare parsing
    if entries.is_empty() && !xml.contains("<D:response>") && !xml.contains("<d:response>") {
        for line in xml.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("<D:href>") || trimmed.starts_with("<d:href>") || trimmed.starts_with("<href>") {
                let href = extract_tag_value(trimmed, "href");
                if let Some(h) = href {
                    if !h.ends_with('/') {
                        let size = 0; // can't easily get size from bare XML
                        entries.push((h, size));
                    }
                }
            }
        }
    }

    entries
}

fn find_any(s: &str, patterns: &[&str], pos: usize) -> Option<usize> {
    let rest = &s[pos..];
    for pat in patterns {
        if let Some(found) = rest.find(pat) {
            return Some(pos + found);
        }
    }
    None
}

fn extract_xml_value(xml: &str, tag: &str) -> Option<String> {
    // Try with namespace prefixes
    for prefix in &["D:", "d:", ""] {
        let open = format!("<{prefix}{tag}>");
        let close = format!("</{prefix}{tag}>");
        if let Some(start) = xml.find(&open) {
            let value_start = start + open.len();
            if let Some(end) = xml[value_start..].find(&close) {
                return Some(xml[value_start..value_start + end].to_string());
            }
        }
    }
    None
}

fn extract_tag_value(line: &str, tag: &str) -> Option<String> {
    for prefix in &["D:", "d:", ""] {
        let open = format!("<{prefix}{tag}>");
        let close = format!("</{prefix}{tag}>");
        if let Some(start) = line.find(&open) {
            let value_start = start + open.len();
            if let Some(end) = line[value_start..].find(&close) {
                return Some(line[value_start..value_start + end].trim().to_string());
            }
        }
    }
    None
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
    if lower.contains("linux") { tags.push("linux".to_string()); }
    if lower.contains("windows") { tags.push("windows".to_string()); }
    if lower.contains("portable") { tags.push("portable".to_string()); }
    if lower.contains("demo") { tags.push("demo".to_string()); }

    (title, tags)
}
