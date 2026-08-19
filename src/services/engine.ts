// First-launch engine boot: extract the bundled Python + yt-dlp payloads, then self-update
// yt-dlp in the background (V1's updateYoutubeDL-on-first-launch behavior).

import YtPluckModule from 'yt-pluck';
import { usePrefs } from '../stores/prefs';

export async function bootEngine(): Promise<boolean> {
  const prefs = usePrefs.getState();
  if (prefs.engineBooted) return true;
  const ok = await Promise.race([
    YtPluckModule.initEngineAsync(),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 60000)),
  ]);
  if (ok) {
    // Wait (bounded) for the yt-dlp self-update so the FIRST analyze uses the latest binary —
    // the bundled one goes stale fast against TikTok/X. The native side keeps running even if
    // the timeout gives up; probes also self-heal on failure.
    await Promise.race([
      YtPluckModule.updateEngineAsync(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 20000)),
    ]);
    usePrefs.getState().markEngineBooted();
  }
  // On failure, do NOT mark booted — the next launch retries. Probes also self-heal natively.
  return ok;
}
