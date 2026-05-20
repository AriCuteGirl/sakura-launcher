import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Save, X, Plus, FolderOpen, ArrowLeft } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useGameStore, type Game } from "../store/useGameStore";

const ALL_GENRES = [
  "Action", "Adventure", "RPG", "Strategy", "Simulation",
  "Sports", "Racing", "Horror", "Puzzle", "Platformer", "FPS", "MOBA", "Indie",
];

const emptyGame = (): Omit<Game, "id" | "date_added"> => ({
  title: "",
  description: "",
  genre: [],
  cover_url: "",
  banner_url: "",
  screenshots: [],
  exe_path: "",
  install_dir: "",
  bunnycdn_download_url: null,
  playtime_seconds: 0,
  last_played: null,
  developer: "",
  tags: [],
  achievement_count: 0,
  achievements_unlocked: 0,
});

export default function AddGame() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { games, addGame, updateGame } = useGameStore();
  const isEdit = !!id;

  const [form, setForm] = useState<Omit<Game, "id" | "date_added">>(emptyGame());
  const [tagInput, setTagInput] = useState("");
  const [screenshotInput, setScreenshotInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      const existing = games.find((g) => g.id === id);
      if (existing) {
        const { id: _id, date_added: _da, ...rest } = existing;
        setForm(rest);
      }
    }
  }, [id, games]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleGenre = (g: string) => {
    set("genre", form.genre.includes(g) ? form.genre.filter((x) => x !== g) : [...form.genre, g]);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      set("tags", [...form.tags, t]);
    }
    setTagInput("");
  };

  const addScreenshot = () => {
    const s = screenshotInput.trim();
    if (s) set("screenshots", [...form.screenshots, s]);
    setScreenshotInput("");
  };

  const pickExe = async () => {
    const path = await open({
      title: "Select Game Executable",
      filters: [{ name: "Executable", extensions: ["exe", "sh", "AppImage", "bin", ""] }],
    });
    if (path) set("exe_path", path as string);
  };

  const pickInstallDir = async () => {
    const path = await open({ directory: true, title: "Select Install Directory" });
    if (path) set("install_dir", path as string);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      alert("Title is required");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && id) {
        const existing = games.find((g) => g.id === id)!;
        await updateGame({ ...existing, ...form });
        navigate(`/game/${id}`);
      } else {
        const newGame: Game = {
          ...form,
          id: crypto.randomUUID(),
          date_added: new Date().toISOString(),
        };
        await addGame(newGame);
        navigate("/library");
      }
    } catch (e) {
      alert(`Failed to save: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      key="add-game"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="page-container"
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sakura-muted hover:text-sakura-text hover:bg-white/5 transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-sakura-pink to-sakura-purple bg-clip-text text-transparent">
            {isEdit ? "Edit Game" : "Add Game"}
          </h1>
        </div>

        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
              Title *
            </label>
            <input
              className="sakura-input"
              placeholder="Game title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          {/* Developer */}
          <div>
            <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
              Developer
            </label>
            <input
              className="sakura-input"
              placeholder="Developer / Publisher"
              value={form.developer}
              onChange={(e) => set("developer", e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              className="sakura-input resize-none"
              rows={3}
              placeholder="Game description..."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          {/* Genre */}
          <div>
            <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
              Genre
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_GENRES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
                  className={`px-3 py-1 rounded-full text-xs transition-all border ${
                    form.genre.includes(g)
                      ? "bg-sakura-purple/20 border-sakura-purple text-sakura-purple"
                      : "border-sakura-border text-sakura-muted hover:border-sakura-purple/50"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Cover / Banner */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
                Cover Art URL (BunnyCDN)
              </label>
              <input
                className="sakura-input"
                placeholder="https://..."
                value={form.cover_url}
                onChange={(e) => set("cover_url", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
                Banner URL (BunnyCDN)
              </label>
              <input
                className="sakura-input"
                placeholder="https://..."
                value={form.banner_url}
                onChange={(e) => set("banner_url", e.target.value)}
              />
            </div>
          </div>

          {/* Screenshots */}
          <div>
            <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
              Screenshots (BunnyCDN URLs)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                className="sakura-input"
                placeholder="https://..."
                value={screenshotInput}
                onChange={(e) => setScreenshotInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addScreenshot()}
              />
              <button onClick={addScreenshot} className="sakura-btn-ghost px-3 flex-shrink-0">
                <Plus size={14} />
              </button>
            </div>
            {form.screenshots.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.screenshots.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 bg-white/5 border border-sakura-border rounded-lg px-2 py-1 text-xs"
                  >
                    <span className="truncate max-w-[160px] text-sakura-muted">{s}</span>
                    <button
                      onClick={() =>
                        set("screenshots", form.screenshots.filter((_, j) => j !== i))
                      }
                      className="text-sakura-muted hover:text-red-400 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BunnyCDN Download URL */}
          <div>
            <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
              BunnyCDN Download URL (ZIP)
            </label>
            <input
              className="sakura-input"
              placeholder="https://your-cdn.b-cdn.net/game.zip"
              value={form.bunnycdn_download_url ?? ""}
              onChange={(e) => set("bunnycdn_download_url", e.target.value || null)}
            />
          </div>

          {/* Exe path */}
          <div>
            <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
              Executable Path
            </label>
            <div className="flex gap-2">
              <input
                className="sakura-input"
                placeholder="/path/to/game.exe"
                value={form.exe_path}
                onChange={(e) => set("exe_path", e.target.value)}
              />
              <button onClick={pickExe} className="sakura-btn-ghost px-3 flex-shrink-0 flex items-center gap-1.5 text-sm">
                <FolderOpen size={14} />
                Browse
              </button>
            </div>
          </div>

          {/* Install dir */}
          <div>
            <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
              Install Directory
            </label>
            <div className="flex gap-2">
              <input
                className="sakura-input"
                placeholder="/path/to/games/mygame"
                value={form.install_dir}
                onChange={(e) => set("install_dir", e.target.value)}
              />
              <button onClick={pickInstallDir} className="sakura-btn-ghost px-3 flex-shrink-0 flex items-center gap-1.5 text-sm">
                <FolderOpen size={14} />
                Browse
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-sakura-muted uppercase tracking-wider mb-1.5">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                className="sakura-input"
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag()}
              />
              <button onClick={addTag} className="sakura-btn-ghost px-3 flex-shrink-0">
                <Plus size={14} />
              </button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.tags.map((t) => (
                  <span
                    key={t}
                    className="tag-badge flex items-center gap-1.5 cursor-pointer hover:border-red-400/50 hover:text-red-400 transition-colors"
                    onClick={() => set("tags", form.tags.filter((x) => x !== t))}
                  >
                    {t} <X size={10} />
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="sakura-btn flex items-center gap-2"
            >
              <Save size={15} />
              {saving ? "Saving..." : isEdit ? "Update Game" : "Add Game"}
            </button>
            <button onClick={() => navigate(-1)} className="sakura-btn-ghost flex items-center gap-2">
              <X size={15} />
              Cancel
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
