import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Clock, Trophy } from "lucide-react";
import type { Game } from "../store/useGameStore";
import { formatPlaytime } from "../store/useGameStore";
import { useState } from "react";

interface Props {
  game: Game;
  view: "grid" | "list";
  onContextMenu: (e: React.MouseEvent, game: Game) => void;
}

function getInitials(title: string): string {
  return title.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function GameCard({ game, view, onContextMenu }: Props) {
  const navigate = useNavigate();
  const [coverError, setCoverError] = useState(false);
  const showPlaceholder = !game.cover_url || coverError;

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
        {showPlaceholder ? (
          <div className="w-14 h-18 rounded-lg flex-shrink-0 bg-sakura-bg-light flex items-center justify-center" style={{ height: "4.5rem", width: "3.5rem" }}>
            <span className="text-lg font-bold text-sakura-pink/40 select-none">{getInitials(game.title)}</span>
          </div>
        ) : (
          <img
            src={game.cover_url}
            alt={game.title}
            className="w-14 h-18 rounded-lg object-cover flex-shrink-0 bg-sakura-bg-light"
            style={{ height: "4.5rem" }}
            onError={() => setCoverError(true)}
          />
        )}
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
        {showPlaceholder ? (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sakura-pink/20 to-sakura-purple/10">
            <span className="text-3xl font-bold text-sakura-pink/30 select-none">{getInitials(game.title)}</span>
          </div>
        ) : (
          <img
            src={game.cover_url}
            alt={game.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setCoverError(true)}
          />
        )}
        {/* Hover overlay — just info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
          <div className="text-xs text-sakura-muted">
            Click to view details
          </div>
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
