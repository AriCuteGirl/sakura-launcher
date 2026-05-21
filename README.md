# 🌸 Sakura Launcher

A beautiful, blazing-fast desktop game launcher — built with Tauri v2 + React.

![Sakura Launcher](https://via.placeholder.com/900x500/0d0d1a/ff6eb4?text=🌸+Sakura+Launcher)

## ✨ Features

- **Game Library** — Grid/list view, search, genre filter, sort, right-click context menu
- **Game Detail** — Hero banner, cover art, screenshots, playtime tracker
- **Downloader** — Real-time download with progress bar, speed, ETA, auto-extract ZIP/RAR/7z
- **Store** — Browse available games, install with one click
- **Achievements** — Per-game achievements with unlock notifications
- **Playtime Tracking** — Auto-tracked per session, displayed as HH:MM
- **Wine Support** — Windows games (.exe) launch via Wine on Linux
- **Stop Button** — Running games show a Stop button (like Steam)
- **Settings** — Install directory, storage config, theme toggle (dark/light)
- **System Tray** — Minimize to tray, tray menu
- **Cherry Blossom Petals** — Floating sakura petals animation 🌸

## 🚀 Quick Start

### Linux

1. Download the latest `.AppImage` from [Releases](https://github.com/AriCuteGirl/sakura-launcher/releases)
2. Make it executable:
   ```bash
   chmod +x Sakura-Launcher-*.AppImage
   ./Sakura-Launcher-*.AppImage
   ```
3. Or install the `.deb` package:
   ```bash
   sudo dpkg -i Sakura-Launcher-*.deb
   ```

### Windows

1. Download the latest `.exe` installer from [Releases](https://github.com/AriCuteGirl/sakura-launcher/releases)
2. Run the installer and follow the setup wizard

## 🛠️ Building from Source

```bash
# Prerequisites
# Linux: sudo pacman -S webkit2gtk-4.1 gtk3 libayatana-appindicator  (Arch)
# Linux: sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev  (Debian/Ubuntu)

git clone https://github.com/AriCuteGirl/sakura-launcher.git
cd sakura-launcher
npm install
cargo tauri build
```

Output artifacts are in `src-tauri/target/release/bundle/`.

## ⚙️ Configuration

Go to **Settings** to configure:
- **Install Directory** — Where games are installed (e.g. `~/Games`)
- **Storage** — BunnyCDN Pull Zone URL for game downloads
- **RAWG API Key** — Auto-fetch game metadata (descriptions, covers, ratings)
- **Theme** — Sakura Dark / Sakura Light
- **Language** — English, Čeština, 日本語, and more 🌍

## 🗄️ Database

SQLite stored at:
- **Linux**: `~/.local/share/sakura-launcher/sakura.db`
- **Windows**: `%APPDATA%/com.sakura.launcher/sakura.db`

## 🎨 Design

| Token | Value |
|-------|-------|
| Background | `#0d0d1a` |
| Primary (Sakura Pink) | `#ff6eb4` |
| Secondary (Purple) | `#c084fc` |
| Card bg | `rgba(255,255,255,0.05)` glassmorphism |
| Hover glow | `box-shadow: 0 0 20px rgba(255,110,180,0.4)` |
| Font | Inter |

## 📜 License

MIT — do whatever you want with it. 🌸
