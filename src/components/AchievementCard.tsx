import { motion } from "framer-motion";
import { Trophy, Lock } from "lucide-react";
import type { Achievement } from "../store/useGameStore";

interface Props {
  achievement: Achievement;
  onUnlock?: (id: string) => void;
}

export default function AchievementCard({ achievement, onUnlock }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 p-3 glass-card transition-all ${
        achievement.unlocked
          ? "border-yellow-500/30 bg-yellow-500/5"
          : "opacity-60"
      }`}
    >
      {/* Icon */}
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          achievement.unlocked
            ? "bg-gradient-to-br from-yellow-400/20 to-orange-500/20"
            : "bg-white/5"
        }`}
      >
        {achievement.icon_url ? (
          <img
            src={achievement.icon_url}
            alt={achievement.name}
            className="w-8 h-8 rounded-lg object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : achievement.unlocked ? (
          <Trophy size={22} className="text-yellow-400" />
        ) : (
          <Lock size={20} className="text-sakura-muted" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4
            className={`font-semibold text-sm truncate ${
              achievement.unlocked ? "text-yellow-300" : "text-sakura-muted"
            }`}
          >
            {achievement.name}
          </h4>
          {achievement.unlocked && (
            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full flex-shrink-0">
              Unlocked
            </span>
          )}
        </div>
        <p className="text-xs text-sakura-muted mt-0.5 truncate">{achievement.description}</p>
        {achievement.unlocked && achievement.unlocked_at && (
          <p className="text-xs text-sakura-muted/60 mt-0.5">
            {new Date(achievement.unlocked_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Unlock button */}
      {!achievement.unlocked && onUnlock && (
        <button
          onClick={() => onUnlock(achievement.id)}
          className="flex-shrink-0 sakura-btn-ghost text-xs py-1 px-3"
        >
          Unlock
        </button>
      )}
    </motion.div>
  );
}
