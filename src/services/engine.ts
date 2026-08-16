// First-launch engine boot: extract the bundled Python + yt-dlp payloads, then self-update
// yt-dlp in the background (V1's updateYoutubeDL-on-first-launch behavior).

import YtPluckModule from 'yt-pluck';
import { getFlag } from './remoteConfig';
import { usePrefs } from '../stores/prefs';

export async function bootEngine(): Promise<boolean> {
  const prefs = usePrefs.getState();
  if (prefs.engineBooted) return true;
  const ok = await YtPluckModule.initEngineAsync();
  if (ok && getFlag('engine_update_enabled')) {
    // initEngineAsync already triggers a background update; a foreground update is only
    // exposed via Settings → "Update downloader".
  }
  usePrefs.getState().markEngineBooted();
  return ok;
}