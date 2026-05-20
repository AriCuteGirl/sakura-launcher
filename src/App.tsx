import { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import TitleBar from "./components/TitleBar";
import ResizeHandles from "./components/ResizeHandles";
import Sidebar from "./components/Sidebar";
import Library from "./pages/Library";
import Browse from "./pages/Browse";
import GameDetail from "./pages/GameDetail";
import EditGame from "./pages/AddGame";
import Achievements from "./pages/Achievements";
import Friends from "./pages/Friends";
import Settings from "./pages/Settings";
import { useGameStore } from "./store/useGameStore";
import { listen } from "@tauri-apps/api/event";

// ── Onichan easter egg ─────────────────────────────────────────────────
let onichanBuffer = "";
const ONICHAN = "onichan";
let uwuActive = false;

function handleOnichanKey(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  if (!target || (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && target.tagName !== "SELECT")) return;
  
  onichanBuffer = (onichanBuffer + e.key.toLowerCase()).slice(-ONICHAN.length);
  
  if (onichanBuffer === ONICHAN && !uwuActive) {
    uwuActive = true;
    document.body.classList.add("uwu-mode");
    // Create sparkle rain
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const sparkle = document.createElement("div");
        sparkle.className = "uwu-sparkle";
        sparkle.textContent = ["✨", "🌸", "💖", "🌟", "🎀", "💕", "🩷"][Math.floor(Math.random() * 7)];
        sparkle.style.left = Math.random() * 100 + "vw";
        sparkle.style.animationDuration = (2 + Math.random() * 3) + "s";
        sparkle.style.fontSize = (14 + Math.random() * 20) + "px";
        document.body.appendChild(sparkle);
        setTimeout(() => sparkle.remove(), 5000);
      }, i * 100);
    }
    onichanBuffer = "";
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("keyup", handleOnichanKey);
}

export default function App() {
  const { loadGames, loadFriends, updateGamePlaytime, setDownloadProgress, removeDownloadProgress } =
    useGameStore();

  useEffect(() => {
    loadGames();
    loadFriends();

    const unlistenProgress = listen<{
      game_id: string;
      percent: number;
      speed_mbps: number;
      eta_seconds: number;
      downloaded_bytes: number;
      total_bytes: number;
    }>("download-progress", (event) => {
      setDownloadProgress(event.payload.game_id, event.payload);
    });

    const unlistenComplete = listen<{ game_id: string }>("download-complete", (event) => {
      removeDownloadProgress(event.payload.game_id);
      loadGames();
    });

    const unlistenExited = listen<{ game_id: string; playtime_seconds: number }>(
      "game-exited",
      (event) => {
        updateGamePlaytime(event.payload.game_id, event.payload.playtime_seconds);
      }
    );

    const unlistenError = listen<{ game_id: string; error: string }>(
      "download-error",
      (event) => {
        removeDownloadProgress(event.payload.game_id);
        console.error(`Download failed for ${event.payload.game_id}: ${event.payload.error}`);
      }
    );

    return () => {
      unlistenProgress.then((f) => f());
      unlistenComplete.then((f) => f());
      unlistenExited.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, []);

  return (
    <HashRouter>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-sakura-bg">
        <TitleBar />
        <ResizeHandles />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Navigate to="/library" replace />} />
                <Route path="/library" element={<Library />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/game/:id" element={<GameDetail />} />
                <Route path="/edit/:id" element={<EditGame />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/friends" element={<Friends />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}
