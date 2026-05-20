import { motion } from "framer-motion";
import { Gamepad2, Trash2 } from "lucide-react";
import type { Friend } from "../store/useGameStore";

interface Props {
  friend: Friend;
  onToggleOnline: (id: string, online: boolean) => void;
  onRemove: (id: string) => void;
}

export default function FriendCard({ friend, onToggleOnline, onRemove }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 glass-card group hover:border-sakura-pink/30 transition-all"
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sakura-pink/30 to-sakura-purple/30 flex items-center justify-center text-sakura-text font-bold text-sm">
          {friend.username[0]?.toUpperCase() ?? "?"}
        </div>
        {/* Online dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-sakura-bg ${
            friend.online ? "bg-green-400" : "bg-sakura-muted"
          }`}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-sakura-text truncate">{friend.username}</p>
        <p className="text-xs text-sakura-muted">
          {friend.online
            ? friend.current_game
              ? `Playing ${friend.current_game}`
              : "Online"
            : "Offline"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onToggleOnline(friend.id, !friend.online)}
          title={friend.online ? "Set Offline" : "Set Online"}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            friend.online
              ? "text-green-400 hover:bg-green-500/10"
              : "text-sakura-muted hover:bg-white/5"
          }`}
        >
          <Gamepad2 size={14} />
        </button>
        <button
          onClick={() => onRemove(friend.id)}
          title="Remove Friend"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sakura-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </motion.div>
  );
}
