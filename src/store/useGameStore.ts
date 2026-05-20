import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface Game {
  id: string;
  title: string;
  description: string;
  genre: string[];
  cover_url: string;
  banner_url: string;
  screenshots: string[];
  exe_path: string;
  install_dir: string;
  bunnycdn_download_url: string | null;
  playtime_seconds: number;
  last_played: string | null;
  date_added: string;
  developer: string;
  tags: string[];
  achievement_count: number;
  achievements_unlocked: number;
}

export interface Achievement {
  id: string;
  game_id: string;
  name: string;
  description: string;
  icon_url: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface Friend {
  id: string;
  username: string;
  online: boolean;
  current_game: string | null;
}

export interface DownloadInfo {
  game_id: string;
  percent: number;
  speed_mbps: number;
  eta_seconds: number;
  downloaded_bytes: number;
  total_bytes: number;
}

interface GameStore {
  games: Game[];
  friends: Friend[];
  downloads: Record<string, DownloadInfo>;
  currentlyPlaying: string | null;
  loadGames: () => Promise<void>;
  scanGames: (scanDir: string) => Promise<number>;
  loadFriends: () => Promise<void>;
  addGame: (game: Game) => Promise<void>;
  updateGame: (game: Game) => Promise<void>;
  removeGame: (id: string) => Promise<void>;
  launchGame: (exe_path: string, game_id: string) => Promise<void>;
  downloadGame: (url: string, install_dir: string, game_id: string) => Promise<void>;
  setDownloadProgress: (game_id: string, info: DownloadInfo) => void;
  removeDownloadProgress: (game_id: string) => void;
  updateGamePlaytime: (game_id: string, added_seconds: number) => void;
  setCurrentlyPlaying: (game_id: string | null) => void;
  addFriend: (username: string) => Promise<void>;
  removeFriend: (id: string) => Promise<void>;
  setFriendOnline: (id: string, online: boolean) => Promise<void>;
}

export const useGameStore = create<GameStore>((set, get) => ({
  games: [],
  friends: [],
  downloads: {},
  currentlyPlaying: null,

  loadGames: async () => {
    try {
      const games = await invoke<Game[]>("get_all_games");
      set({ games });
    } catch (e) {
      console.error("Failed to load games:", e);
    }
  },

  scanGames: async (scanDir: string) => {
    try {
      const found = await invoke<Game[]>("scan_games", { scanDir });
      await get().loadGames();
      return found.length;
    } catch (e) {
      console.error("Scan failed:", e);
      throw e;
    }
  },

  loadFriends: async () => {
    try {
      const friends = await invoke<Friend[]>("get_friends");
      set({ friends });
    } catch (e) {
      console.error("Failed to load friends:", e);
    }
  },

  addGame: async (game) => {
    await invoke("add_game", { game });
    await get().loadGames();
  },

  updateGame: async (game) => {
    await invoke("update_game", { game });
    await get().loadGames();
  },

  removeGame: async (id) => {
    await invoke("remove_game", { id });
    set((state) => ({ games: state.games.filter((g) => g.id !== id) }));
  },

  launchGame: async (exe_path, game_id) => {
    set({ currentlyPlaying: game_id });
    await invoke("launch_game", { exePath: exe_path, gameId: game_id });
  },

  downloadGame: async (url, install_dir, game_id) => {
    await invoke("download_game", { url, installDir: install_dir, gameId: game_id });
  },

  setDownloadProgress: (game_id, info) => {
    set((state) => ({
      downloads: { ...state.downloads, [game_id]: info },
    }));
  },

  removeDownloadProgress: (game_id) => {
    set((state) => {
      const d = { ...state.downloads };
      delete d[game_id];
      return { downloads: d };
    });
  },

  updateGamePlaytime: (game_id, added_seconds) => {
    set((state) => ({
      currentlyPlaying: state.currentlyPlaying === game_id ? null : state.currentlyPlaying,
      games: state.games.map((g) =>
        g.id === game_id
          ? { ...g, playtime_seconds: g.playtime_seconds + added_seconds }
          : g
      ),
    }));
  },

  setCurrentlyPlaying: (game_id) => set({ currentlyPlaying: game_id }),

  addFriend: async (username) => {
    await invoke("add_friend", { username });
    await get().loadFriends();
  },

  removeFriend: async (id) => {
    await invoke("remove_friend", { id });
    set((state) => ({ friends: state.friends.filter((f) => f.id !== id) }));
  },

  setFriendOnline: async (id, online) => {
    await invoke("set_online_status", { id, online });
    set((state) => ({
      friends: state.friends.map((f) => (f.id === id ? { ...f, online } : f)),
    }));
  },
}));

export function formatPlaytime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
