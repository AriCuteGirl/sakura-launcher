import { useGameStore } from "../store/useGameStore";

export function usePlaytime(game_id: string) {
  const { games } = useGameStore();
  const game = games.find((g) => g.id === game_id);
  return {
    playtime_seconds: game?.playtime_seconds ?? 0,
    last_played: game?.last_played ?? null,
  };
}

export function formatPlaytime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
