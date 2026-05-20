import { useState } from "react";
import { motion } from "framer-motion";
import { Users, UserPlus } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import FriendCard from "../components/FriendCard";
import { useTranslation } from "../hooks/useTranslation";

export default function Friends() {
  const { friends, addFriend, removeFriend, setFriendOnline } = useGameStore();
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const u = username.trim();
    if (!u) return;
    setAdding(true);
    try {
      await addFriend(u);
      setUsername("");
    } catch (e) {
      alert(`Failed to add friend: ${e}`);
    } finally {
      setAdding(false);
    }
  };

  const onlineCount = friends.filter((f) => f.online).length;

  return (
    <motion.div
      key="friends"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="page-container"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="space-y-0">
          <h1 className="text-xl font-bold bg-gradient-to-r from-sakura-pink to-sakura-purple bg-clip-text text-transparent leading-none">
            {t("friendsPage")}
          </h1>
          <p className="text-sakura-muted text-sm leading-tight">
            {onlineCount} {t("online")} · {friends.length} {t("total_")}
          </p>
        </div>
      </div>

      {/* Add friend */}
      <div className="glass-card p-4 mb-6">
        <h2 className="text-sm font-semibold text-sakura-text mb-3 flex items-center gap-2">
          <UserPlus size={15} className="text-sakura-pink" />
          {t("addFriend")}
        </h2>
        <div className="flex gap-2">
          <input
            className="sakura-input"
            placeholder={t("username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !username.trim()}
            className="sakura-btn text-sm px-4 flex-shrink-0"
          >
            {adding ? t("adding") : t("add")}
          </button>
        </div>
      </div>

      {/* Friends list */}
      {friends.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-sakura-muted gap-3">
          <Users size={40} className="text-sakura-muted/40" />
          <p className="text-lg font-semibold">{t("noFriendsYet")}</p>
          <p className="text-sm">{t("addFriendByUsername")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Online first */}
          {friends.filter((f) => f.online).length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-sakura-muted uppercase tracking-wider px-1 mb-2">
                {t("online_")} — {friends.filter((f) => f.online).length}
              </p>
              {friends
                .filter((f) => f.online)
                .map((friend) => (
                  <div key={friend.id} className="mb-2">
                    <FriendCard
                      friend={friend}
                      onToggleOnline={setFriendOnline}
                      onRemove={removeFriend}
                    />
                  </div>
                ))}
            </div>
          )}
          {friends.filter((f) => !f.online).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-sakura-muted uppercase tracking-wider px-1 mb-2">
                {t("offline")} — {friends.filter((f) => !f.online).length}
              </p>
              {friends
                .filter((f) => !f.online)
                .map((friend) => (
                  <div key={friend.id} className="mb-2">
                    <FriendCard
                      friend={friend}
                      onToggleOnline={setFriendOnline}
                      onRemove={removeFriend}
                    />
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
