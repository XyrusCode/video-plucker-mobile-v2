// Download orchestration: probe (analyze), then start with cookies resolved.

import YtPluckModule from 'yt-pluck';
import type { ProbeResult, QualityId } from 'yt-pluck';
import { resolveCookiesFile } from '../lib/cookies';

/** Fetch metadata for a URL (yt-dlp getInfo). Throws with the engine's message on failure. */
export async function probeUrl(url: string): Promise<ProbeResult> {
  let res: (Partial<ProbeResult> & { ok?: boolean; error?: string }) | null;
  try {
    // Probes use the platform's cookies too — TikTok/X analysis fails without them.
    const cookiesPath = await resolveCookiesFile(url);
    res = (await YtPluckModule.probeAsync(url, cookiesPath)) as
      | (Partial<ProbeResult> & { ok?: boolean; error?: string })
      | null;
  } catch (e) {
    throw new Error(describeNativeFailure(e));
  }
  if (!res || res.ok === false) {
    const detail = res?.error?.trim();
    throw new Error(
      detail && detail !== 'Analysis failed'
        ? `Analysis failed: ${detail}`
        : 'Analysis failed. The downloader engine reported an error — update it in Settings → Update downloader and try again.'
    );
  }
  return res as ProbeResult;
}

/** Turn a bare native rejection into a readable message (the bridge can drop details). */
function describeNativeFailure(e: unknown): string {
  if (e instanceof Error) {
    const msg = e.message?.trim();
    if (msg && msg !== 'Analysis failed') return `Analysis failed: ${msg}`;
    return 'Analysis failed (no details from the engine)';
  }
  const raw = typeof e === 'string' ? e : String(e);
  return raw.trim() ? `Analysis failed: ${raw}` : 'Analysis failed (no details from the engine)';
}

/**
 * Start a download. Resolves the platform's cookies (if any), passes the cookies.txt path to
 * the native side (which deletes the temp file after the run), and returns the job id.
 */
export async function startDownload(url: string, qualityId: QualityId): Promise<string | null> {
  const cookiesPath = await resolveCookiesFile(url);
  return YtPluckModule.startDownloadAsync(url, qualityId, cookiesPath);
}