import { NavLink, useNavigate } from "react-router-dom";
import { Library, Package, Trophy, Users, Settings, Gamepad2 } from "lucide-react";
import { useGameStore } from "../store/useGameStore";

const navItems = [
  { to: "/library", icon: Library, label: "Library" },
  { to: "/browse", icon: Package, label: "Store" },
  { to: "/achievements", icon: Trophy, label: "Achievements" },
  { to: "/friends", icon: Users, label: "Friends" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { games, currentlyPlaying } = useGameStore();
  const playingGame = games.find((g) => g.id === currentlyPlaying);

  return (
    <aside className="w-16 flex flex-col items-center py-4 gap-2 bg-[#0a0a18] border-r border-sakura-border flex-shrink-0">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          title={label}
          className={({ isActive }) =>
            `w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative ${
              isActive
                ? "bg-gradient-to-br from-sakura-pink/20 to-sakura-purple/20 text-sakura-pink shadow-glow-sm"
                : "text-sakura-muted hover:text-sakura-text hover:bg-white/5"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={18} />
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-sakura-pink rounded-r-full" />
              )}
              <span className="absolute left-14 bg-[#1a1a2e] text-sakura-text text-xs px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-sakura-border">
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}

      <div className="flex-1" />

      {/* Currently playing indicator */}
      {playingGame && (
        <div
          title={`Playing: ${playingGame.title}`}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-green-400 animate-pulse bg-green-500/10 relative group"
        >
          <Gamepad2 size={18} />
          <span className="absolute left-14 bg-[#1a1a2e] text-sakura-text text-xs px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-sakura-border">
            Playing: {playingGame.title}
          </span>
        </div>
      )}
    </aside>
  );
}
