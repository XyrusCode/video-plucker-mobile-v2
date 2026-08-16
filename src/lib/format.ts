// Formatting helpers ported from V1 (Formatters.kt).

/** "1.2 MB/s" style speed from bytes/sec; "-" when unknown. */
export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 0) return '-';
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`;
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '-';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatEta(etaSeconds: number): string {
  if (etaSeconds < 0) return '-';
  if (etaSeconds < 60) return `${Math.round(etaSeconds)}s`;
  if (etaSeconds < 3600) return `${Math.floor(etaSeconds / 60)}m ${Math.round(etaSeconds % 60)}s`;
  return `${Math.floor(etaSeconds / 3600)}h ${Math.floor((etaSeconds % 3600) / 60)}m`;
}

/** Compact date for history rows. */
export function formatDate(epochSeconds: number): string {
  if (!epochSeconds) return '-';
  const d = new Date(epochSeconds * 1000);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}