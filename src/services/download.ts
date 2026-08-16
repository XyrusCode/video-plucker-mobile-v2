// Download orchestration: probe (analyze), then start with cookies resolved.

import YtPluckModule from 'yt-pluck';
import type { ProbeResult, QualityId } from 'yt-pluck';
import { resolveCookiesFile } from '../lib/cookies';

/** Fetch metadata for a URL (yt-dlp getInfo). Throws with the engine's message on failure. */
export async function probeUrl(url: string): Promise<ProbeResult> {
  return YtPluckModule.probeAsync(url);
}

/**
 * Start a download. Resolves the platform's cookies (if any), passes the cookies.txt path to
 * the native side (which deletes the temp file after the run), and returns the job id.
 */
export async function startDownload(url: string, qualityId: QualityId): Promise<string | null> {
  const cookiesPath = await resolveCookiesFile(url);
  return YtPluckModule.startDownloadAsync(url, qualityId, cookiesPath);
}