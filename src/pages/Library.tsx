import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutGrid, List, SortAsc, Play, FolderOpen, Edit, Trash2, ScanSearch, Scan } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { open as openFolder } from "@tauri-apps/plugin-shell";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import GameCard from "../components/GameCard";
import SearchBar from "../components/SearchBar";
import PetalAnimation from "../components/PetalAnimation";
import { useGameStore, formatPlaytime, type Game } from "../store/useGameStore";
import { useTranslation } from "../hooks/useTranslation";

const GENRES = [
  "All", "Action", "Adventure", "RPG", "Strategy", "Simulation",
  "Sports", "Racing", "Horror", "Puzzle", "Platformer", "FPS", "MOBA",
];

const SORT_OPTIONS = [
  { value: "title", label: "Name" },
  { value: "last_played", label: "Recently Played" },
  { value: "playtime_seconds", label: "Playtime" },
  { value: "date_added", label: "Date Added" },
];

interface ContextMenu {
  x: number;
  y: number;
  game: Game;
}

export default function Library() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { games, removeGame, launchGame, scanGames } = useGameStore();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [sort, setSort] = useState("title");
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    let result = games.filter((g) => {
      const matchSearch =
        g.title.toLowerCase().includes(search.toLowerCase()) ||
        g.developer.toLowerCase().includes(search.toLowerCase()) ||
        g.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchGenre = selectedGenre === "All" || g.genre.includes(selectedGenre);
      return matchSearch && matchGenre;
    });

    result = [...result].sort((a, b) => {
      switch (sort) {
        case "title":
          return a.title.localeCompare(b.title);
        case "last_played":
          return (b.last_played ?? "").localeCompare(a.last_played ?? "");
        case "playtime_seconds":
          return b.playtime_seconds - a.playtime_seconds;
        case "date_added":
          return b.date_added.localeCompare(a.date_added);
        default:
          return 0;
      }
    });

    return result;
  }, [games, search, selectedGenre, sort]);

  const handleContextMenu = useCallback((e: React.MouseEvent, game: Game) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, game });
  }, []);

  const handleLaunch = async (game: Game) => {
    setContextMenu(null);
    if (game.exe_path) {
      await launchGame(game.exe_path, game.id);
    }
  };

  const handleOpenFolder = async (game: Game) => {
    setContextMenu(null);
    if (game.install_dir) {
      await openFolder(game.install_dir);
    }
  };

  const handleDelete = async (game: Game) => {
    setContextMenu(null);
    if (confirm(`Remove "${game.title}" from library?`)) {
      await removeGame(game.id);
    }
  };

  const handleScan = async () => {
    try {
      const dir = await openDialog({
        directory: true,
        multiple: false,
        title: "Select folder with game files or archives",
      });
      if (!dir) return;

      setScanning(true);
      setScanResult(null);

      const found = await scanGames(dir as string);
      setScanResult(`Found ${found} game${found !== 1 ? "s" : ""}!`);
      setTimeout(() => setScanResult(null), 4000);
    } catch (e) {
      setScanResult(`Scan failed: ${e}`);
      setTimeout(() => setScanResult(null), 4000);
    } finally {
      setScanning(false);
    }
  };

  return (
    <motion.div
      key="library"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col relative overflow-hidden"
    >
      {/* Petal animation background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <PetalAnimation />
        <div className="absolute inset-0 bg-sakura-radial" />
      </div>

        {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Scan result toast */}
        <AnimatePresence>
          {scanResult && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium bg-sakura-pink/20 border border-sakura-pink/40 text-sakura-pink backdrop-blur-sm"
            >
              {scanResult}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-sakura-border bg-sakura-bg/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex-1 max-w-xs">
            <SearchBar value={search} onChange={setSearch} placeholder={t("searchGames")} />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <SortAsc size={15} className="text-sakura-muted" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="sakura-input h-9 text-sm"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === "title" ? t("sortByName") : o.value === "last_played" ? t("sortRecent") : o.value === "playtime_seconds" ? t("sortPlaytime") : o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Scan */}
          <button
            onClick={handleScan}
            disabled={scanning}
            className="sakura-btn-ghost h-9 px-2.5 flex items-center gap-1.5 text-xs"
            title="Scan folder for games"
          >
            <Scan size={14} className={scanning ? "animate-pulse" : ""} />
            {scanning ? "Scanning..." : "Scan"}
          </button>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setView("grid")}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                view === "grid" ? "bg-sakura-pink text-white" : "text-sakura-muted hover:text-white"
              }`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                view === "list" ? "bg-sakura-pink text-white" : "text-sakura-muted hover:text-white"
              }`}
            >
              <List size={14} />
            </button>
          </div>

          <span className="text-xs text-sakura-muted ml-auto">{filtered.length} {t("gamesAvailable")}</span>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Genre sidebar */}
          <div className="w-44 flex-shrink-0 border-r border-sakura-border overflow-y-auto p-3 bg-[#0a0a18]/60">
            <p className="text-xs font-semibold text-sakura-muted uppercase tracking-wider px-2 mb-2">
              {t("genre")}
            </p>
            {GENRES.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all ${
                  selectedGenre === genre
                    ? "bg-sakura-pink/20 text-sakura-pink font-medium"
                    : "text-sakura-muted hover:text-sakura-text hover:bg-white/5"
                }`}
              >
                {genre}
              </button>
            ))}
          </div>

          {/* Games grid/list */}
          <div className="flex-1 overflow-y-auto p-6">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-sakura-muted">
                <span className="text-6xl">🌸</span>
                <p className="text-lg font-semibold">{t("noGamesFound")}</p>
                <p className="text-sm text-center max-w-xs">
                  {games.length === 0
                    ? ""
                    : t("tryDiffFilter")}
                </p>
                {games.length === 0 && (
                  <button
                    onClick={() => navigate("/browse")}
                    className="sakura-btn text-xs px-4 py-1.5 -mt-1"
                  >
                    {t("browseStore")}
                  </button>
                )}
              </div>
            ) : view === "grid" ? (
              <motion.div
                layout
                className="grid gap-4"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                }}
              >
                <AnimatePresence>
                  {filtered.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      view="grid"
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-2">
                <AnimatePresence>
                  {filtered.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      view="list"
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="context-menu-item" onClick={() => handleLaunch(contextMenu.game)}>
              <Play size={13} />
              {t("launch")}
            </div>
            <div
              className="context-menu-item"
              onClick={() => {
                setContextMenu(null);
                navigate(`/edit/${contextMenu.game.id}`);
              }}
            >
              <Edit size={13} />
              {t("edit")}
            </div>
            <div
              className="context-menu-item"
              onClick={() => handleOpenFolder(contextMenu.game)}
            >
              <FolderOpen size={13} />
              {t("openFolder")}
            </div>
            <div
              className="context-menu-item danger"
              onClick={() => handleDelete(contextMenu.game)}
            >
              <Trash2 size={13} />
              {t("remove")}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
