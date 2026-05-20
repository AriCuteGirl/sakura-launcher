import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { useGameStore, type Achievement } from "../store/useGameStore";
import AchievementCard from "../components/AchievementCard";
import { useTranslation } from "../hooks/useTranslation";

export default function Achievements() {
  const { games } = useGameStore();
  const { t } = useTranslation();
  const [allAchievements, setAllAchievements] = useState<(Achievement & { game_title: string })[]>([]);
  const [totalUnlocked, setTotalUnlocked] = useState(0);
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");

  const loadAll = async () => {
    const results: (Achievement & { game_title: string })[] = [];
    for (const game of games) {
      const achs = await invoke<Achievement[]>("get_achievements", { gameId: game.id });
      achs.forEach((a) => results.push({ ...a, game_title: game.title }));
    }
    setAllAchievements(results);

    const total = await invoke<number>("get_total_unlocked");
    setTotalUnlocked(total);
  };

  useEffect(() => {
    loadAll();
  }, [games]);

  const handleUnlock = async (id: string) => {
    await invoke("unlock_achievement", { id });
    const ach = allAchievements.find((a) => a.id === id);
    if (ach) {
      sendNotification({
        title: "🏆 Achievement Unlocked!",
        body: `${ach.game_title}: ${ach.name}`,
      });
    }
    await loadAll();
  };

  const filtered = allAchievements.filter((a) => {
    if (filter === "unlocked") return a.unlocked;
    if (filter === "locked") return !a.unlocked;
    return true;
  });

  const total = allAchievements.length;
  const percent = total > 0 ? Math.round((totalUnlocked / total) * 100) : 0;

  // Group by game
  const byGame: Record<string, (Achievement & { game_title: string })[]> = {};
  filtered.forEach((a) => {
    if (!byGame[a.game_title]) byGame[a.game_title] = [];
    byGame[a.game_title].push(a);
  });

  return (
    <motion.div
      key="achievements"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="page-container"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-sakura-pink to-sakura-purple bg-clip-text text-transparent flex items-center gap-2">
            <Trophy size={20} className="text-yellow-400" />
            {t("achievementsPage")}
          </h1>
          <p className="text-sakura-muted text-sm mt-1">
            {totalUnlocked} {t("of")} {total} {t("unlocked")} ({percent}%)
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {(["all", "unlocked", "locked"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                filter === f
                  ? "bg-sakura-pink text-white"
                  : "text-sakura-muted hover:text-white"
              }`}
            >
              {f === "all" ? t("all_") : f === "unlocked" ? t("unlocked") : t("locked")}
            </button>
          ))}
        </div>
      </div>

      {/* Global progress bar */}
      <div className="glass-card p-4 mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-sakura-muted">{t("overallProgress")}</span>
          <span className="font-bold text-sakura-pink">{percent}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-yellow-400 to-sakura-pink rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Achievements by game */}
      {Object.keys(byGame).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-sakura-muted gap-3">
          <Trophy size={40} className="text-sakura-muted/40" />
          <p className="text-lg font-semibold">{t("noAchievementsFound")}</p>
          <p className="text-sm">{t("addAchFromGame")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byGame).map(([gameTitle, achs]) => (
            <div key={gameTitle}>
              <h2 className="text-sm font-semibold text-sakura-text mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sakura-pink" />
                {gameTitle}
                <span className="text-sakura-muted font-normal">
                  ({achs.filter((a) => a.unlocked).length}/{achs.length})
                </span>
              </h2>
              <div className="space-y-2">
                {achs.map((ach) => (
                  <AchievementCard key={ach.id} achievement={ach} onUnlock={handleUnlock} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
