import { useGameStore } from "../store/useGameStore";

export function useGames() {
  const store = useGameStore();
  return {
    games: store.games,
    loadGames: store.loadGames,
    addGame: store.addGame,
    updateGame: store.updateGame,
    removeGame: store.removeGame,
  };
}
