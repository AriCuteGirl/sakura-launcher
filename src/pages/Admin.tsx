import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Plus, Trash2, Upload, Loader2, Globe, Link, ExternalLink } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface CatalogGameEntry {
  id: string;
  title: string;
  description: string;
  genre: string[];
  cover_url: string;
  banner_url: string;
  screenshots: string[];
  download_url: string;
  developer: string;
  tags: string[];
  size_bytes: number | null;
  version: string | null;
}

interface AppSettings {
  install_dir: string;
  bunnycdn_base_url: string;
  bunnycdn_storage_zone: string;
  bunnycdn_api_key: string;
  theme: string;
  launch_on_startup: boolean;
  language: string;
  goldberg_path?: string;
  rawg_api_key?: string;
  catalog_url?: string;
  github_token?: string;
  github_owner?: string;
  github_repo?: string;
  github_path?: string;
  github_branch?: string;
}

export default function Admin() {
  const [games, setGames] = useState<CatalogGameEntry[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [newGame, setNewGame] = useState<Partial<CatalogGameEntry>>({
    title: "",
    download_url: "",
    cover_url: "",
    developer: "",
    size_bytes: null,
  });

  useEffect(() => {
    loadGames();
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const s = await invoke<AppSettings>("load_settings");
      setSettings(s);
    } catch {}
  }

  async function loadGames() {
    try {
      const g = await invoke<CatalogGameEntry[]>("load_catalog_manager");
      setGames(g);
    } catch {}
  }

  async function handleAdd() {
    if (!newGame.title || !newGame.download_url) {
      setStatus("❌ Title and Download URL are required");
      return;
    }
    const id = newGame.title!.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const game: CatalogGameEntry = {
      id,
      title: newGame.title!,
      description: newGame.description || "",
      genre: [],
      cover_url: newGame.cover_url || "",
      banner_url: "",
      screenshots: [],
      download_url: newGame.download_url!,
      developer: newGame.developer || "",
      tags: [],
      size_bytes: newGame.size_bytes || null,
      version: null,
    };
    try {
      await invoke("add_catalog_game", { game });
      setNewGame({ title: "", download_url: "", cover_url: "", developer: "", size_bytes: null });
      setStatus("✅ Game added!");
      await loadGames();
    } catch (e) {
      setStatus("❌ " + String(e));
    }
  }

  async function handleRemove(id: string) {
    try {
      await invoke("remove_catalog_game", { id });
      await loadGames();
    } catch (e) {
      setStatus("❌ " + String(e));
    }
  }

  async function handlePublish() {
    if (!settings?.github_token || !settings?.github_owner || !settings?.github_repo) {
      setStatus("❌ Configure GitHub Token, Owner, and Repo in settings first.");
      return;
    }
    setPublishing(true);
    setStatus("📤 Publishing to GitHub...");
    try {
      const result = await invoke<string>("publish_catalog", {
        token: settings.github_token,
        owner: settings.github_owner,
        repo: settings.github_repo,
        path: settings.github_path || "catalog.json",
        branch: settings.github_branch || "main",
      });
      setStatus(result);
    } catch (e) {
      setStatus("❌ " + String(e));
    } finally {
      setPublishing(false);
    }
  }

  async function saveSetting(key: string, value: string) {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    try {
      await invoke("save_settings", { settings: updated });
      setSettings(updated);
    } catch (e) {
      setStatus("❌ Save failed: " + String(e));
    }
  }

  return (
    <motion.div
      key="admin"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="page-container"
    >
      <div className="max-w-xl mx-auto">
        <h1 className="text-xl font-bold bg-gradient-to-r from-sakura-pink to-sakura-purple bg-clip-text text-transparent flex items-center gap-2 mb-2">
          <Settings size={20} />
          🎮 Catalog Admin
        </h1>
        <p className="text-xs text-sakura-muted mb-6">
          Add games with public download links, then publish catalog.json to GitHub Pages.
        </p>

        {/* GitHub config */}
        <section className="glass-card p-4 mb-4 space-y-3">
          <h2 className="text-xs font-semibold text-sakura-pink uppercase tracking-wider flex items-center gap-1.5">
            <Globe size={12} /> GitHub
          </h2>
          <input
            className="sakura-input text-sm"
            type="password"
            placeholder="GitHub Token (ghp_...)"
            value={settings?.github_token ?? ""}
            onChange={(e) => saveSetting("github_token", e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="sakura-input text-sm"
              placeholder="Owner (AriCuteGirl)"
              value={settings?.github_owner ?? ""}
              onChange={(e) => saveSetting("github_owner", e.target.value)}
            />
            <input
              className="sakura-input text-sm"
              placeholder="Repo (Catalog)"
              value={settings?.github_repo ?? ""}
              onChange={(e) => saveSetting("github_repo", e.target.value)}
            />
          </div>
          <input
            className="sakura-input text-sm"
            placeholder="Catalog URL (GitHub Pages)"
            value={settings?.catalog_url ?? ""}
            onChange={(e) => saveSetting("catalog_url", e.target.value)}
          />
        </section>

        {/* Game list */}
        <section className="glass-card p-4 mb-4 space-y-3">
          <h2 className="text-xs font-semibold text-sakura-pink uppercase tracking-wider flex items-center gap-1.5">
            <Link size={12} /> Games ({games.length})
          </h2>

          {games.length === 0 && (
            <p className="text-xs text-sakura-muted">No games in catalog yet. Add one below!</p>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {games.map((g) => (
              <div key={g.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-sakura-text truncate">{g.title}</p>
                  <p className="text-xs text-sakura-muted truncate">{g.download_url}</p>
                </div>
                <button
                  onClick={() => handleRemove(g.id)}
                  className="text-red-400 hover:text-red-300 transition-colors ml-2 flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Add game */}
        <section className="glass-card p-4 mb-4 space-y-3">
          <h2 className="text-xs font-semibold text-sakura-pink uppercase tracking-wider flex items-center gap-1.5">
            <Plus size={12} /> Add Game
          </h2>
          <input
            className="sakura-input text-sm"
            placeholder="Game Title"
            value={newGame.title ?? ""}
            onChange={(e) => setNewGame((s) => ({ ...s, title: e.target.value }))}
          />
          <input
            className="sakura-input text-sm"
            placeholder="Download URL (Filen.io public link)"
            value={newGame.download_url ?? ""}
            onChange={(e) => setNewGame((s) => ({ ...s, download_url: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="sakura-input text-sm"
              placeholder="Cover URL (optional)"
              value={newGame.cover_url ?? ""}
              onChange={(e) => setNewGame((s) => ({ ...s, cover_url: e.target.value }))}
            />
            <input
              className="sakura-input text-sm"
              placeholder="Developer (optional)"
              value={newGame.developer ?? ""}
              onChange={(e) => setNewGame((s) => ({ ...s, developer: e.target.value }))}
            />
          </div>
          <button
            onClick={handleAdd}
            className="sakura-btn w-full text-xs py-1.5 flex items-center justify-center gap-1"
          >
            <Plus size={12} /> Add to Catalog
          </button>
        </section>

        {/* Publish */}
        <section className="glass-card p-4 mb-4 space-y-3">
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="sakura-btn w-full text-xs py-2 flex items-center justify-center gap-1.5 bg-gradient-to-r from-sakura-pink to-sakura-purple"
          >
            {publishing ? (
              <><Loader2 size={14} className="animate-spin" /> Publishing...</>
            ) : (
              <><Upload size={14} /> Publish to GitHub Pages</>
            )}
          </button>
          {status && (
            <p
              className="text-xs whitespace-pre-wrap text-center"
              style={{
                color: status.startsWith("✅")
                  ? "#4ade80"
                  : status.startsWith("❌")
                  ? "#f87171"
                  : "#c084fc",
              }}
            >
              {status}
            </p>
          )}
        </section>

        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-sakura-muted">
          <ExternalLink size={11} />
          <span>Tip: Bookmark this page — it's only at #/admin</span>
        </div>
      </div>
    </motion.div>
  );
}
