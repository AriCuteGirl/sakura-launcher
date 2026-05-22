import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download, Search, Loader2, Package, HardDrive } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useGameStore, type Game } from "../store/useGameStore";
import { useTranslation } from "../hooks/useTranslation";

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

interface Catalog {
  games: CatalogGame[];
}

interface RawgMeta {
  cover_url: string | null;
  description: string;
  genres: string[];
  rating: number | null;
}

function getInitials(title: string): string {
  return title.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function Browse() {
  const { games, downloads, addGame, downloadGame } = useGameStore();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rawgCovers, setRawgCovers] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { t } = useTranslation();

  const loadCatalog = async () => {
    setLoading(true);
    setError(null);

    // Try remote catalog URL from settings if configured
    try {
      const settings = await invoke<any>("load_settings");
      if (settings?.catalog_url) {
        const result = await invoke<Catalog>("fetch_remote_catalog", { url: settings.catalog_url });
        setCatalog(result);
        setLoading(false);
        return;
      }
    } catch {}

    try {
      const result = await invoke<Catalog>("fetch_catalog", { baseUrl: "" });
      setCatalog(result);
    } catch (e) {
      // Fallback: try default GitHub Pages catalog
      try {
        const defaultUrl = "https://aricutegirl.github.io/Catalog/catalog.json";
        const result = await invoke<Catalog>("fetch_remote_catalog", { url: defaultUrl });
        setCatalog(result);
      } catch {
        setError(String(e));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // Auto-fetch RAWG covers for games without cover_url
  useEffect(() => {
    if (!catalog?.games) return;
    (async () => {
      try {
        const settings = await invoke<any>("load_settings");
        if (!settings?.rawg_api_key) return;
        for (const cg of catalog.games) {
          if (!cg.cover_url && !rawgCovers[cg.id]) {
            try {
              const meta = await invoke<RawgMeta>("fetch_game_metadata", {
                title: cg.title,
                rawgApiKey: settings.rawg_api_key,
              });
              if (meta?.cover_url) {
                setRawgCovers(prev => ({ ...prev, [cg.id]: meta.cover_url! }));
              }
            } catch {}
          }
        }
      } catch {}
    })();
  }, [catalog]);

  const handleDownload = async (cg: CatalogGame) => {
    // Add to library first
    const newGame: Game = {
      id: cg.id,
      title: cg.title,
      description: cg.description,
      genre: cg.genre,
      cover_url: cg.cover_url,
      banner_url: cg.banner_url,
      screenshots: cg.screenshots,
      exe_path: cg.id + ".exe", // placeholder, will be set after extraction
      install_dir: "", // will default to settings install dir
      bunnycdn_download_url: cg.download_url,
      playtime_seconds: 0,
      last_played: null,
      date_added: new Date().toISOString(),
      developer: cg.developer,
      tags: cg.tags,
      achievement_count: 0,
      achievements_unlocked: 0,
    };
    await addGame(newGame);
    await downloadGame(cg.download_url, "", cg.id);
  };

  const installedIds = new Set(games.map((g) => g.id));

  const filtered = catalog?.games.filter((cg) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      cg.title.toLowerCase().includes(q) ||
      cg.developer.toLowerCase().includes(q) ||
      cg.tags.some((t) => t.toLowerCase().includes(q)) ||
      cg.genre.some((g) => g.toLowerCase().includes(q))
    );
  }) ?? [];

  return (
    <motion.div
      key="browse"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="page-container"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="space-y-0">
          <h1 className="text-xl font-bold bg-gradient-to-r from-sakura-pink to-sakura-purple bg-clip-text text-transparent leading-none">
            {t("browse")}
          </h1>
          <p className="text-sakura-muted text-sm leading-tight">
            {catalog ? `${catalog.games.length} ${t("gamesAvailable")}` : t("loadingCatalog")}
          </p>
        </div>
        <button
          onClick={loadCatalog}
          disabled={loading}
          className="sakura-btn-ghost text-sm px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0"
        >
          <Loader2 size={14} className={loading ? "animate-spin" : ""} />
          {t("refresh")}
        </button>
      </div>

      {/* Search — spans the same full width as the grid */}
      <div className="mb-5 w-full">
        <div className="relative flex items-center">
          <Search size={15} className="absolute left-3 text-sakura-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchCatalog")}
            className="sakura-input pl-9 h-9"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card p-6 mb-6 text-center border-yellow-500/30">
          <p className="text-sakura-muted text-sm mb-3">{error}</p>
          <div className="flex gap-2 justify-center">
            <button onClick={loadCatalog} className="sakura-btn-ghost text-xs px-3 py-1.5">
              {t("retry")}
            </button>
            <button onClick={() => window.location.hash = "#/settings"} className="sakura-btn text-xs px-3 py-1.5">
              {t("openSettings")}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-sakura-muted gap-3">
          <Loader2 size={40} className="animate-spin text-sakura-pink" />
          <p className="text-lg font-semibold">{t("loadingCatalog")}</p>
        </div>
      )}

      {/* Games grid */}
      {!loading && catalog && (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
        >
          {filtered.map((cg) => {
            const installed = installedIds.has(cg.id);
            const dl = downloads[cg.id];
            const coverSrc = rawgCovers[cg.id] || cg.cover_url;
            const showPlaceholder = !coverSrc;

            const handleImageError = async () => {
              if (rawgCovers[cg.id]) return;
              try {
                const settings = await invoke<any>("load_settings");
                if (settings?.rawg_api_key) {
                  const meta = await invoke<RawgMeta>("fetch_game_metadata", {
                    title: cg.title,
                    rawgApiKey: settings.rawg_api_key,
                  });
                  if (meta?.cover_url) {
                    setRawgCovers(prev => ({ ...prev, [cg.id]: meta.cover_url! }));
                    return;
                  }
                }
              } catch {}
            };

            return (
              <motion.div
                key={cg.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`glass-card overflow-hidden transition-all cursor-pointer ${
                  installed ? "border-green-500/30" : "hover:border-sakura-pink/40 hover:shadow-glow"
                }`}
                onClick={() => navigate(`/game/${cg.id}`, { state: { catalogGame: cg } })}
              >
                {/* Cover */}
                <div className="aspect-[3/4] overflow-hidden bg-sakura-bg-light relative">
                  {showPlaceholder ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sakura-pink/20 to-sakura-purple/10">
                      <span className="text-4xl font-bold text-sakura-pink/30 select-none">
                        {getInitials(cg.title)}
                      </span>
                    </div>
                  ) : (
                    <img
                      src={coverSrc}
                      alt={cg.title}
                      className="w-full h-full object-cover"
                      onError={handleImageError}
                    />
                  )}
                  {installed && (
                    <div className="absolute top-2 right-2 bg-green-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <HardDrive size={10} /> Installed
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className="font-semibold text-sm text-sakura-text truncate">
                    {cg.title}
                  </h3>
                  <p className="text-xs text-sakura-muted mt-0.5 truncate">
                    {cg.developer}
                    {cg.version && ` · v${cg.version}`}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {cg.genre.slice(0, 2).map((g) => (
                      <span key={g} className="genre-badge">{g}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-sakura-muted">
                    {cg.size_bytes && (
                      <span><HardDrive size={9} className="inline mr-0.5" />{formatSize(cg.size_bytes)}</span>
                    )}
                  </div>

                  {/* Action */}
                  {dl ? (
                    <div className="mt-2">
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sakura-pink rounded-full transition-all"
                          style={{ width: `${dl.percent}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-sakura-muted mt-1 text-center">
                        {dl.percent.toFixed(0)}% · {dl.speed_mbps.toFixed(1)} MB/s
                      </p>
                    </div>
                  ) : installed ? (
                    <div className="mt-2 text-xs text-green-400 text-center font-medium">
                      {t("inLibrary")}
                    </div>
                  ) : (
                    cg.download_url.includes("filen.io") ? (
                      <div className="flex flex-col gap-1.5 mt-2">
                        <button
                          onClick={() => invoke("open_filen_download", { url: cg.download_url })}
                          className="sakura-btn text-xs py-1.5 flex items-center justify-center gap-1 bg-gradient-to-r from-blue-500/30 to-purple-500/30"
                        >
                          <Download size={12} />
                          Open Download Page
                        </button>
                        <button
                          onClick={async () => {
                            const { open } = await import("@tauri-apps/plugin-dialog");
                            const file = await open({
                              multiple: false,
                              filters: [{ name: "Archives", extensions: ["zip", "7z", "rar"] }],
                            });
                            if (file) {
                              await invoke("import_game_file", {
                                filePath: file,
                                gameId: cg.id,
                                title: cg.title,
                                downloadUrl: cg.download_url,
                                coverUrl: cg.cover_url,
                                developer: cg.developer,
                                tags: cg.tags,
                              });
                              await loadCatalog();
                            }
                          }}
                          className="sakura-btn-ghost text-[10px] py-1 flex items-center justify-center gap-1"
                        >
                          📂 Import File
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownload(cg)}
                        className="sakura-btn w-full mt-2 text-xs py-1.5 flex items-center justify-center gap-1"
                      >
                        <Download size={12} />
                        {t("install")}
                      </button>
                    )
                  )}
                </div>
              </motion.div>
            );
          })}

          {filtered.length === 0 && !loading && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-sakura-muted gap-3">
              <Package size={40} className="text-sakura-muted/40" />
              <p className="text-lg font-semibold">
                {search ? t("noMatchingGames") : t("noGamesCatalog")}
              </p>
              <p className="text-sm text-center max-w-sm">
                {search
                  ? t("tryDifferentSearch")
                  : "Upload a catalog.json to your BunnyCDN storage zone"}
              </p>
              <button onClick={loadCatalog} className="sakura-btn-ghost text-sm mt-2">
                {t("tryAgain")}
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
