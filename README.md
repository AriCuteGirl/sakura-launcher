# 🌸 Sakura Launcher

A beautiful, blazing-fast desktop game launcher inspired by Hydra Launcher — powered by BunnyCDN, built with Tauri v2 + React.

![Sakura Launcher](https://via.placeholder.com/900x500/0d0d1a/ff6eb4?text=🌸+Sakura+Launcher)

## ✨ Features

- **Game Library** — Grid/list view, search, genre filter, sort options, right-click context menu
- **Game Detail** — Hero banner, cover art, screenshots carousel, playtime tracker
- **Downloader** — Real-time BunnyCDN download with progress bar, speed, ETA, auto-extract ZIP
- **Achievements** — Per-game manual achievements with unlock notifications
- **Friends** — Basic friend list with online status and currently-playing display
- **Playtime Tracking** — Auto-tracked per session, stored in SQLite, displayed as HH:MM
- **Settings** — Install dir, BunnyCDN base URL, theme toggle, clear library
- **System Tray** — Minimize to tray, tray menu, click to show/hide
- **Custom Window** — Frameless with custom drag region and window controls
- **Cherry Blossom Petals** — Canvas animation on the library page 🌸

## 🛠️ Prerequisites

- [Rust](https://rustup.rs/) (stable, latest)
- [Node.js](https://nodejs.org/) v18+
- [Tauri CLI v2](https://tauri.app/start/):
  ```bash
  cargo install tauri-cli --version "^2"
  ```
- Linux: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, etc.
  ```bash
  # Ubuntu/Debian
  sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  # Arch/EndeavourOS
  sudo pacman -S webkit2gtk-4.1 gtk3 libayatana-appindicator
  ```

## 🚀 Development

```bash
# Clone / enter directory
cd sakura-launcher

# Install JS dependencies
npm install

# Run in dev mode (hot reload)
cargo tauri dev
```

## 📦 Build

```bash
# Release build
cargo tauri build
```

Output artifacts are in `src-tauri/target/release/bundle/`:
- **Linux**: `.deb` (Debian/Ubuntu), `.AppImage` (portable)
- **Windows**: `.exe` NSIS installer, `.msi`
- **macOS**: `.dmg`, `.app`

## 🐰 Setting Up BunnyCDN

1. Create a **Storage Zone** in the BunnyCDN dashboard
2. Upload your game files (ZIPs, cover art, banners, screenshots) to the storage zone
3. Create a **Pull Zone** and link it to your storage zone
4. Note your Pull Zone URL, e.g. `https://your-zone.b-cdn.net`

### Upload a game ZIP

```bash
# Using BunnyCDN API
curl --request PUT \
  --url "https://storage.bunnycdn.com/YOUR_STORAGE_ZONE/games/mygame.zip" \
  --header "AccessKey: YOUR_ACCESS_KEY" \
  --data-binary @mygame.zip
```

### Adding the game in Sakura Launcher

1. Click **+** in the sidebar or go to **Add Game**
2. Fill in:
   - **Title**: My Awesome Game
   - **Cover Art URL**: `https://your-zone.b-cdn.net/covers/mygame.jpg`
   - **Banner URL**: `https://your-zone.b-cdn.net/banners/mygame.jpg`
   - **Screenshots**: `https://your-zone.b-cdn.net/screenshots/mygame_1.jpg`
   - **BunnyCDN Download URL**: `https://your-zone.b-cdn.net/games/mygame.zip`
   - **Executable Path**: path after extraction, e.g. `/home/user/Games/mygame/mygame.sh`
   - **Install Directory**: `/home/user/Games/mygame`

## ⚙️ Setting BunnyCDN Base URL

Go to **Settings → BunnyCDN Base URL** and enter `https://your-zone.b-cdn.net`.  
This prefix is saved and can be referenced when building image URLs.

## 🗄️ Database

Sakura uses SQLite stored at `~/.local/share/sakura-launcher/sakura.db`.  
Tables: `games`, `achievements`, `friends`.

## 🎨 Design System

| Token | Value |
|-------|-------|
| Background | `#0d0d1a` |
| Primary (Sakura Pink) | `#ff6eb4` |
| Secondary (Purple) | `#c084fc` |
| Card bg | `rgba(255,255,255,0.05)` glassmorphism |
| Hover glow | `box-shadow: 0 0 20px rgba(255,110,180,0.4)` |
| Font | Inter |

## 📁 Project Structure

```
sakura-launcher/
├── src-tauri/src/
│   ├── main.rs              Entry point
│   ├── lib.rs               App setup, tray, DB init
│   ├── commands/            Tauri commands (Rust)
│   │   ├── games.rs         CRUD for game library
│   │   ├── launcher.rs      Launch game + playtime tracking
│   │   ├── downloader.rs    BunnyCDN streaming download + ZIP extract
│   │   ├── playtime.rs      Session timing
│   │   ├── achievements.rs  Achievement CRUD + unlock
│   │   └── friends.rs       Friends CRUD
│   └── models/              Rust structs (Game, Achievement, Friend)
└── src/
    ├── App.tsx              Router + event listeners
    ├── pages/               Library, GameDetail, AddGame, Achievements, Friends, Settings
    ├── components/          TitleBar, Sidebar, GameCard, etc.
    ├── store/               Zustand global state
    └── hooks/               useGames, usePlaytime, useDownloader
```

## 📜 License

MIT — do whatever you want with it. 🌸
