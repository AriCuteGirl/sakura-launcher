use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Achievement {
    pub id: String,
    pub game_id: String,
    pub name: String,
    pub description: String,
    pub icon_url: String,
    pub unlocked: bool,
    pub unlocked_at: Option<String>,
}
