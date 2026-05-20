use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Friend {
    pub id: String,
    pub username: String,
    pub online: bool,
    pub current_game: Option<String>,
}
