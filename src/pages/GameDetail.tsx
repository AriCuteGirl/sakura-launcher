import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Download, Edit, ArrowLeft, Clock, Calendar, ChevronLeft, ChevronRight, Trophy, Plus,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { open } from "@tauri-apps/plugin-dialog";
import { useGameStore, formatPlaytime, type Achievement } from "../store/useGameStore";
import AchievementCard from "../components/AchievementCard";
import DownloadProgress from "../components/DownloadProgress";
import { useTranslation } from "../hooks/useTranslation";

interface RawgMetadata {
  rawg_id: number | null;
  description: string;
  genres: string[];
  cover_url: string | null;
  release_date: string | null;
  rating: number | null;
  metacritic: number | null;
  platforms: string[];
}

interface CatalogGame {
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

export default function GameDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { games, launchGame, downloadGame, downloads, currentlyPlaying, setCurrentlyPlaying, updateGamePlaytime } = useGameStore();
  const catalogGame = (location.state as any)?.catalogGame as CatalogGame | undefined;
  const game = games.find((g) => g.id === id) || catalogGame as any;

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [screenshotIdx, setScreenshotIdx] = useState(0);
  const [showAddAch, setShowAddAch] = useState(false);
  const [achForm, setAchForm] = useState({ name: "", description: "", icon_url: "" });
  const [rawgData, setRawgData] = useState<RawgMetadata | null>(null);
  const [rawgLoading, setRawgLoading] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [bannerError, setBannerError] = useState(false);
  const downloadInfo = id ? downloads[id] : undefined;
  const { t } = useTranslation();

  useEffect(() => {
    if (id) {
      invoke<Achievement[]>("get_achievements", { gameId: id }).then(setAchievements);
    }
  }, [id]);

  useEffect(() => {
    if (!game) return;
    (async () => {
      try {
        const settings = await invoke<any>("load_settings");
        console.log("GameDetail RAWG: settings", settings?.rawg_api_key ? "has key" : "no key");
        if (!settings?.rawg_api_key) return;
        setRawgLoading(true);
        console.log("GameDetail: fetching RAWG for", game.title);
        const meta = await invoke<RawgMetadata>("fetch_game_metadata", {
          title: game.title,
          rawgApiKey: settings.rawg_api_key,
        });
        console.log("GameDetail: RAWG response", meta);
        if (meta) {
          if (meta.cover_url) setCoverError(false);
          setRawgData(meta);
        }
      } catch (e) {
        console.error("GameDetail RAWG error:", e);
      } finally {
        setRawgLoading(false);
      }
    })();
  }, [game?.title]);

  if (!game) {
    return (
      <div className="flex items-center justify-center h-full text-sakura-muted">
        <div className="text-center">
          <span className="text-4xl">🌸</span>
          <p className="mt-2">Game not found</p>
          <button onClick={() => navigate("/library")} className="sakura-btn mt-4">
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  const handleLaunch = async () => {
    if (!game.exe_path) {
      alert("No executable path set. Please edit the game to set the path.");
      return;
    }
    await launchGame(game.exe_path, game.id);
  };

  const handleStop = async () => {
    await invoke("stop_game", { gameId: game.id });
    setCurrentlyPlaying(null);
  };

  const isRunning = currentlyPlaying === game?.id;

  const handleDownload = async () => {
    const dlUrl = game.bunnycdn_download_url || (game as any).download_url;
    if (!dlUrl) return;

    // Check if it's a Filen.io URL → open embedded webview
    if (dlUrl.includes("filen.io")) {
      await invoke("open_filen_download", { url: dlUrl });
      return;
    }

    let dir = game.install_dir;
    if (!dir) {
      const selected = await open({ directory: true, title: "Choose install directory" });
      if (!selected) return;
      dir = selected as string;
    }
    await downloadGame(dlUrl, dir, game.id);
  };

  const handleUnlockAchievement = async (ach_id: string) => {
    await invoke("unlock_achievement", { id: ach_id });
    const updated = await invoke<Achievement[]>("get_achievements", { gameId: game.id });
    setAchievements(updated);
    const ach = updated.find((a) => a.id === ach_id);
    if (ach) {
      sendNotification({
        title: "🏆 Achievement Unlocked!",
        body: `${game.title}: ${ach.name}`,
      });
    }
  };

  const handleAddAchievement = async () => {
    if (!achForm.name.trim()) return;
    const ach: Achievement = {
      id: crypto.randomUUID(),
      game_id: game.id,
      name: achForm.name,
      description: achForm.description,
      icon_url: achForm.icon_url,
      unlocked: false,
      unlocked_at: null,
    };
    await invoke("add_achievement", { achievement: ach });
    const updated = await invoke<Achievement[]>("get_achievements", { gameId: game.id });
    setAchievements(updated);
    setAchForm({ name: "", description: "", icon_url: "" });
    setShowAddAch(false);
  };

  const screenshots = game.screenshots.filter(Boolean);

  return (
    <motion.div
      key={`game-${id}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full overflow-y-auto"
    >
      {/* Hero banner */}
      <div className="relative h-56 overflow-hidden flex-shrink-0">
        {bannerError || !game.banner_url ? (
          <div className="w-full h-full bg-gradient-to-br from-sakura-pink/20 via-sakura-bg to-sakura-purple/20 flex items-center justify-center">
            <span className="text-6xl">🌸</span>
          </div>
        ) : (
          <img
            src={game.banner_url}
            alt={game.title}
            className="w-full h-full object-cover"
            onError={() => setBannerError(true)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-sakura-bg via-sakura-bg/40 to-transparent" />

        {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 flex items-center gap-1.5 text-sm text-sakura-text bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-black/60 transition-all"
          >
            <ArrowLeft size={14} />
            {t("back")}
          </button>
      </div>

      <div className="px-6 pb-8 -mt-16 relative">
        {/* Header row */}
        <div className="flex items-end gap-5 mb-6">
          {/* Cover */}
          <div className="flex-shrink-0 w-28 h-36 rounded-card overflow-hidden border-2 border-sakura-border shadow-card bg-sakura-bg-light">
            {coverError || (!game.cover_url && !rawgData?.cover_url) ? (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sakura-pink/20 to-sakura-purple/10">
                <span className="text-xl font-bold text-sakura-pink/40 select-none">
                  {game.title.split(/\s+/).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                </span>
              </div>
            ) : (
              <img
                src={rawgData?.cover_url || game.cover_url}
                alt={game.title}
                className="w-full h-full object-cover"
                onError={() => setCoverError(true)}
              />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 pb-2">
            <h1 className="text-2xl font-bold text-sakura-text">{game.title}</h1>
            <p className="text-sakura-muted text-sm mt-1">{game.developer}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {game.genre.map((g: string) => (
                <span key={g} className="genre-badge">
                  {g}
                </span>
              ))}
              {game.tags.map((t: string) => (
                <span key={t} className="tag-badge">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pb-2 flex-shrink-0">
            {isRunning ? (
              <button onClick={handleStop} className="sakura-btn flex items-center gap-2 text-sm px-5 py-2 bg-red-500/20 border-red-500/40 text-white hover:bg-red-500/30">
                ⏹ Stop
              </button>
            ) : game.exe_path ? (
              <>
                <button
                  onClick={() => navigate(`/edit/${game.id}`)}
                  className="sakura-btn-ghost w-9 h-9 p-0 flex items-center justify-center"
                >
                  <Edit size={15} />
                </button>
                <button onClick={handleLaunch} className="sakura-btn flex items-center gap-2 text-sm px-5 py-2">
                  <Play size={15} />
                  {t("launchGame")}
                </button>
              </>
            ) : (
              <>
                {((game as any).download_url || game.bunnycdn_download_url) && !downloadInfo && (
                  <button onClick={handleDownload} className="sakura-btn flex items-center gap-2 text-sm px-5 py-2">
                    <Download size={15} />
                    {t("download")}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Download progress */}
        {downloadInfo && (
          <div className="mb-6">
            <DownloadProgress {...downloadInfo} />
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="glass-card p-3 flex items-center gap-3">
            <Clock size={18} className="text-sakura-pink" />
            <div>
              <p className="text-xs text-sakura-muted">{t("playtime")}</p>
              <p className="font-semibold text-sm">{game.exe_path ? formatPlaytime(game.playtime_seconds ?? 0) : t("notInstalled")}</p>
            </div>
          </div>
          <div className="glass-card p-3 flex items-center gap-3">
            <Calendar size={18} className="text-sakura-purple" />
            <div>
              <p className="text-xs text-sakura-muted">{t("lastPlayed")}</p>
              <p className="font-semibold text-sm">
                {game.last_played
                  ? new Date(game.last_played).toLocaleDateString()
                  : game.exe_path ? "Never" : "—"}
              </p>
            </div>
          </div>
          <div className="glass-card p-3 flex items-center gap-3">
            <Trophy size={18} className="text-yellow-400" />
            <div>
              <p className="text-xs text-sakura-muted">{t("achievements")}</p>
              <p className="font-semibold text-sm">
                {(game.achievements_unlocked ?? 0)}/{(game.achievement_count ?? 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {(game.description || rawgData?.description) && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-sakura-muted uppercase tracking-wider mb-2">{t("about")}</h2>
            <p className="text-sakura-text text-sm leading-relaxed">
              {(game.description && game.description !== "0") ? game.description : (rawgData?.description || "")}
            </p>
          </div>
        )}

        {/* RAWG data */}
        {rawgLoading && (
          <div className="glass-card p-4 mb-6 text-center text-sakura-muted text-sm">
            Loading game info...
          </div>
        )}
        {rawgData && (
          <div className="mb-6 space-y-4">
            {rawgData.platforms.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-sakura-muted uppercase tracking-wider mb-2">{t("platforms")}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {rawgData.platforms.map((p: string) => (
                    <span key={p} className="genre-badge">{p}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {rawgData.rating ? (
                <div className="glass-card p-3 min-w-[140px] flex-1">
                  <p className="text-xs text-sakura-muted">{t("rating")}</p>
                  <p className="font-semibold text-sm text-yellow-400">
                    {'★'.repeat(Math.round(rawgData.rating))}
                    {'☆'.repeat(5 - Math.round(rawgData.rating))}
                    {' '}{rawgData.rating.toFixed(1)}
                  </p>
                </div>
              ) : null}
              {rawgData.metacritic ? (
                <div className="glass-card p-3 min-w-[140px] flex-1">
                  <p className="text-xs text-sakura-muted">Metacritic</p>
                  <p className={`font-semibold text-sm ${rawgData.metacritic >= 75 ? 'text-green-400' : rawgData.metacritic >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{rawgData.metacritic}</p>
                </div>
              ) : null}
              {rawgData.release_date ? (
                <div className="glass-card p-3 min-w-[140px] flex-1">
                  <p className="text-xs text-sakura-muted">Released</p>
                  <p className="font-semibold text-sm text-sakura-text">{rawgData.release_date}</p>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Screenshots carousel */}
        {screenshots.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-sakura-muted uppercase tracking-wider mb-3">
              Screenshots
            </h2>
            <div className="relative">
              <div className="aspect-video rounded-card overflow-hidden bg-sakura-bg-light">
                <img
                  src={screenshots[screenshotIdx]}
                  alt={`Screenshot ${screenshotIdx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              {screenshots.length > 1 && (
                <>
                  <button
                    onClick={() => setScreenshotIdx((i) => (i - 1 + screenshots.length) % screenshots.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setScreenshotIdx((i) => (i + 1) % screenshots.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <div className="flex justify-center gap-1.5 mt-2">
                    {screenshots.map((_: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => setScreenshotIdx(i)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          i === screenshotIdx ? "bg-sakura-pink w-4" : "bg-sakura-muted"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Achievements */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-sakura-muted uppercase tracking-wider">
              Achievements ({achievements.filter((a) => a.unlocked).length}/{achievements.length})
            </h2>
            <button
              onClick={() => setShowAddAch(!showAddAch)}
              className="sakura-btn-ghost text-xs py-1 px-3 flex items-center gap-1"
            >
              <Plus size={12} />
              Add
            </button>
          </div>

          {/* Add achievement form */}
          <AnimatePresence>
            {showAddAch && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="glass-card p-4 mb-3 space-y-3"
              >
                <h3 className="text-sm font-semibold text-sakura-pink">New Achievement</h3>
                <input
                  className="sakura-input"
                  placeholder="Achievement name *"
                  value={achForm.name}
                  onChange={(e) => setAchForm((f) => ({ ...f, name: e.target.value }))}
                />
                <input
                  className="sakura-input"
                  placeholder="Description"
                  value={achForm.description}
                  onChange={(e) => setAchForm((f) => ({ ...f, description: e.target.value }))}
                />
                <input
                  className="sakura-input"
                  placeholder="Icon URL (optional)"
                  value={achForm.icon_url}
                  onChange={(e) => setAchForm((f) => ({ ...f, icon_url: e.target.value }))}
                />
                <div className="flex gap-2">
                  <button onClick={handleAddAchievement} className="sakura-btn text-sm py-1.5 px-4">
                    Save
                  </button>
                  <button
                    onClick={() => setShowAddAch(false)}
                    className="sakura-btn-ghost text-sm py-1.5 px-4"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            {achievements.length === 0 ? (
              <p className="text-sakura-muted text-sm py-4 text-center">
                No achievements yet. Add some!
              </p>
            ) : (
              achievements.map((ach) => (
                <AchievementCard
                  key={ach.id}
                  achievement={ach}
                  onUnlock={handleUnlockAchievement}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
