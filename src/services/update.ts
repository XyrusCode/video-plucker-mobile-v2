// Self-update checker — port of V1's UpdateChecker.kt. The JS layer owns the update flow
// (GitHub API check → download → install), mirroring the app-foreground-only UX of V1.

import * as Application from 'expo-application';
import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';

const REPO = 'XyrusCode/video-plucker';

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
 * Check GitHub for a newer release. Returns null when the installed version is current
 * (or the check fails — a failed check is not a hard error, the UI shows "up to date").
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  const current = Application.nativeApplicationVersion;
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) return null;
  const release = await res.json();
  const tag = String(release.tag_name ?? '').replace(/^v/, '');
  if (!tag || !current || isVersionAtLeast(current, tag)) return null;
  const asset = (release.assets ?? []).find(
    (a: { name?: string }) =>
      a.name === 'app-universal-release.apk' || /universal.*\.apk$/i.test(a.name ?? '')
  );
  return {
    latestVersion: tag,
    downloadUrl: asset?.browser_download_url ?? null,
    notes: release.body ?? null,
    sizeBytes: asset?.size ?? 0,
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