import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Clock, Trophy } from "lucide-react";
import type { Game } from "../store/useGameStore";
import { formatPlaytime } from "../store/useGameStore";

interface Props {
  game: Game;
  view: "grid" | "list";
  onContextMenu: (e: React.MouseEvent, game: Game) => void;
}

export default function GameCard({ game, view, onContextMenu }: Props) {
  const navigate = useNavigate();

  if (view === "list") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        onClick={() => navigate(`/game/${game.id}`)}
        onContextMenu={(e) => onContextMenu(e, game)}
        className="flex items-center gap-4 p-3 glass-card cursor-pointer hover:border-sakura-pink/40 hover:shadow-glow-sm transition-all group"
      >
        <img
          src={game.cover_url || "https://via.placeholder.com/60x80/0d0d1a/ff6eb4?text=🌸"}
          alt={game.title}
          className="w-14 h-18 rounded-lg object-cover flex-shrink-0 bg-sakura-bg-light"
          style={{ height: "4.5rem" }}
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://via.placeholder.com/60x80/0d0d1a/ff6eb4?text=🌸";
          }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sakura-text truncate group-hover:text-sakura-pink transition-colors">
            {game.title}
          </h3>
          <p className="text-xs text-sakura-muted mt-0.5 truncate">{game.developer}</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {game.genre.slice(0, 3).map((g) => (
              <span key={g} className="genre-badge">
                {g}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 text-xs text-sakura-muted">
          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>{formatPlaytime(game.playtime_seconds)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Trophy size={12} />
            <span>
              {game.achievements_unlocked}/{game.achievement_count}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/game/${game.id}`);
            }}
            className="sakura-btn text-xs py-1 px-3 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Play size={12} className="inline mr-1" />
            Play
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={() => navigate(`/game/${game.id}`)}
      onContextMenu={(e) => onContextMenu(e, game)}
      className="glass-card cursor-pointer hover:border-sakura-pink/40 hover:shadow-glow transition-all group overflow-hidden"
    >
      {/* Cover art */}
      <div className="relative aspect-[3/4] overflow-hidden bg-sakura-bg-light">
        <img
          src={game.cover_url || "https://via.placeholder.com/300x400/0d0d1a/ff6eb4?text=🌸"}
          alt={game.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://via.placeholder.com/300x400/0d0d1a/ff6eb4?text=🌸";
          }}
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
          <button className="sakura-btn text-xs w-full py-1.5" onClick={(e) => e.stopPropagation()}>
            <Play size={12} className="inline mr-1" />
            Play
          </button>
        </div>
        {/* Achievement badge */}
        {game.achievement_count > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs">
            <Trophy size={10} className="text-yellow-400" />
            <span className="text-sakura-text">
              {game.achievements_unlocked}/{game.achievement_count}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-sm text-sakura-text truncate group-hover:text-sakura-pink transition-colors">
          {game.title}
        </h3>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {game.genre.slice(0, 2).map((g) => (
            <span key={g} className="genre-badge">
              {g}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1 mt-2 text-xs text-sakura-muted">
          <Clock size={11} />
          <span>{formatPlaytime(game.playtime_seconds)}</span>
        </div>
      </div>
    </motion.div>
  );
}
