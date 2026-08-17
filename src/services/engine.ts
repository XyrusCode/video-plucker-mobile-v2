// First-launch engine boot: extract the bundled Python + yt-dlp payloads, then self-update
// yt-dlp in the background (V1's updateYoutubeDL-on-first-launch behavior).

import YtPluckModule from 'yt-pluck';
import { usePrefs } from '../stores/prefs';

export async function bootEngine(): Promise<boolean> {
  const prefs = usePrefs.getState();
  if (prefs.engineBooted) return true;
  const ok = await YtPluckModule.initEngineAsync();
  if (ok) {
    // initEngineAsync already triggers a background yt-dlp update.
    usePrefs.getState().markEngineBooted();
  }
  // On failure, do NOT mark booted — the next launch retries. Probes also self-heal natively.
  return ok;
}
