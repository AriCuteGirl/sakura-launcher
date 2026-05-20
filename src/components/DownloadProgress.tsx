import { motion } from "framer-motion";
import { Download, Zap, Clock } from "lucide-react";

interface Props {
  game_id: string;
  percent: number;
  speed_mbps: number;
  eta_seconds: number;
  downloaded_bytes: number;
  total_bytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatEta(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

export default function DownloadProgress({
  percent,
  speed_mbps,
  eta_seconds,
  downloaded_bytes,
  total_bytes,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 space-y-3"
    >
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-sakura-pink font-semibold">
          <Download size={15} className="animate-bounce" />
          <span>Downloading...</span>
        </div>
        <span className="text-sakura-text font-bold">{percent.toFixed(1)}%</span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-sakura-pink to-sakura-purple rounded-full"
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3 }}
        />
        {/* Shimmer */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
      </div>

      <div className="flex items-center justify-between text-xs text-sakura-muted">
        <div className="flex items-center gap-1">
          <Zap size={11} className="text-sakura-pink" />
          <span>{speed_mbps.toFixed(2)} MB/s</span>
        </div>
        <span>
          {formatBytes(downloaded_bytes)} / {formatBytes(total_bytes)}
        </span>
        <div className="flex items-center gap-1">
          <Clock size={11} />
          <span>ETA: {formatEta(eta_seconds)}</span>
        </div>
      </div>
    </motion.div>
  );
}
