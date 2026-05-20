import { useGameStore } from "../store/useGameStore";

export function useDownloader(game_id: string) {
  const { downloads, downloadGame, removeDownloadProgress } = useGameStore();
  const info = downloads[game_id];

  return {
    isDownloading: !!info,
    progress: info ?? null,
    startDownload: (url: string, install_dir: string) =>
      downloadGame(url, install_dir, game_id),
    cancelProgress: () => removeDownloadProgress(game_id),
  };
}
