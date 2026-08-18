// Self-update checker — port of V1's UpdateChecker.kt. The JS layer owns the update flow
// (GitLab Releases API check → download → install), mirroring the app-foreground-only UX of V1.

import * as Application from 'expo-application';
import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';

// Project must be public for unauthenticated in-app checks and APK downloads to work.
const PROJECT_PATH = 'KyriosNyx/video-plucker-mobile-v2';
const PROJECT_API_ID = encodeURIComponent(PROJECT_PATH);
const GITLAB = 'https://gitlab.com';

export interface UpdateInfo {
  latestVersion: string;
  downloadUrl: string;
  /** Release notes (CHANGELOG-derived body). */
  notes: string | null;
  /** Asset size in bytes, when known. */
  sizeBytes: number;
}

export interface UpdateProgress {
  /** 0..100 */
  percent: number;
}

/**
 * Check GitLab for a newer release. Returns null when the installed version is current
 * (or the check fails — a failed check is not a hard error, the UI shows "up to date").
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  const current = Application.nativeApplicationVersion;
  const res = await fetch(
    `${GITLAB}/api/v4/projects/${PROJECT_API_ID}/releases/permalink/latest`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) return null;
  const release = await res.json();
  const tag = String(release.tag_name ?? '').replace(/^v/, '');
  if (!tag || !current || isVersionAtLeast(current, tag)) return null;

  const assetLink = (release.assets?.links ?? []).find(
    (l: { name?: string; url?: string }) =>
      l.name === 'app-universal-release.apk' ||
      /universal.*\.apk$/i.test(l.name ?? '') ||
      (l.url ?? '').includes('app-universal-release.apk')
  );
  const downloadUrl =
    assetLink?.direct_asset_url ??
    assetLink?.url ??
    `${GITLAB}/${PROJECT_PATH}/-/packages/generic/video-plucker/${tag}/app-universal-release.apk`;
  return {
    latestVersion: tag,
    downloadUrl,
    notes: release.description ?? null,
    sizeBytes: 0,
  };
}

export async function downloadUpdate(
  url: string,
  onProgress: (p: UpdateProgress) => void
): Promise<File> {
  const dir = new Directory(Paths.cache, 'updates');
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, 'video-plucker.apk');
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(url, target, {
    onProgress: (e) => {
      if (e.totalBytes > 0) {
        onProgress({ percent: (e.bytesWritten / e.totalBytes) * 100 });
      }
    },
  });
  return file;
}

/** Fire the package installer at the downloaded APK. */
export async function installUpdate(file: File): Promise<void> {
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: file.contentUri,
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}

function isVersionAtLeast(installed: string, latest: string): boolean {
  const a = installed.split('.').map(Number);
  const b = latest.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}
