import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

export default function TitleBar() {
  const appWindow = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-10 px-4 bg-sakura-bg border-b border-sakura-border flex-shrink-0 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Left: logo + name */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <span className="text-2xl">🌸</span>
        <span className="font-bold text-sm bg-gradient-to-r from-sakura-pink to-sakura-purple bg-clip-text text-transparent">
          Sakura Launcher
        </span>
      </div>

      {/* Right: window controls */}
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          onClick={() => appWindow.minimize()}
          className="w-8 h-8 rounded-md flex items-center justify-center text-sakura-muted hover:text-sakura-text hover:bg-white/10 transition-all"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="w-8 h-8 rounded-md flex items-center justify-center text-sakura-muted hover:text-sakura-text hover:bg-white/10 transition-all"
        >
          <Square size={12} />
        </button>
        <button
          onClick={() => appWindow.hide()}
          className="w-8 h-8 rounded-md flex items-center justify-center text-sakura-muted hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
