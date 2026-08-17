#!/usr/bin/env node
// F-Droid build: a GMS-free unsigned release APK. F-Droid's policy requires apps to build
// without Google Play Services, so this script:
//   1. Temporarily excludes @react-native-firebase/* from native autolinking,
//   2. Drops the Firebase config plugin (withYtPluckAndroid stays — it skips release signing
//      for this store), and removes the google-services gradle plugin + config file,
//   3. Builds with an empty Sentry DSN (crash reporting off) and EXPO_PUBLIC_STORE=fdroid
//      (in-app self-updater hidden — F-Droid manages updates),
//   4. Restores package.json / app.json afterwards, no matter what.
//
// Usage: node scripts/build-fdroid.mjs
// Output: dist/fdroid/video-plucker-fdroid.apk (+ submission.md for f-droid.org).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON = join(ROOT, 'package.json');
const APP_JSON = join(ROOT, 'app.json');
const EXCLUDED_PKGS = ['@react-native-firebase/app', '@react-native-firebase/remote-config'];

const originalPkg = readFileSync(PACKAGE_JSON, 'utf8');
const originalApp = readFileSync(APP_JSON, 'utf8');

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (exit ${res.status})`);
}

function restore() {
  writeFileSync(PACKAGE_JSON, originalPkg);
  writeFileSync(APP_JSON, originalApp);
}

try {
  // 1. Exclude Firebase packages from native autolinking (JS imports stay — the app degrades
  //    to code defaults when the native module is absent).
  const pkg = JSON.parse(originalPkg);
  pkg.expo = {
    ...pkg.expo,
    autolinking: { ...(pkg.expo?.autolinking ?? {}), exclude: EXCLUDED_PKGS },
  };
  writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n');

  // 2. Drop the Firebase config plugin for this build.
  const app = JSON.parse(originalApp);
  app.expo.plugins = (app.expo.plugins ?? []).filter(
    (p) => p !== '@react-native-firebase/app'
  );
  writeFileSync(APP_JSON, JSON.stringify(app, null, 2) + '\n');

  // 3. Regenerate the native project cleanly.
  run('npx', ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'], {
    env: {
      ...process.env,
      EXPO_PUBLIC_STORE: 'fdroid',
      EXPO_PUBLIC_SENTRY_DSN: '',
    },
  });

  // 4. Strip the google-services gradle plugin + config so no GMS reference survives.
  const gradle = join(ROOT, 'android', 'app', 'build.gradle');
  const text = readFileSync(gradle, 'utf8').replace(
    /\napply plugin: ['"]com\.google\.gms\.google-services['"]\s*/g,
    '\n'
  );
  writeFileSync(gradle, text);
  const gsFile = join(ROOT, 'android', 'app', 'google-services.json');
  if (existsSync(gsFile)) rmSync(gsFile);

  // 5. Build the unsigned release APK.
  run('cmd', ['/c', 'gradlew.bat', 'assembleRelease'], {
    cwd: join(ROOT, 'android'),
  });

  // 6. Collect.
  const apk = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  const outDir = join(ROOT, 'dist', 'fdroid');
  mkdirSync(outDir, { recursive: true });
  renameSync(apk, join(outDir, 'video-plucker-fdroid.apk'));

  const appName = app.expo.name ?? 'Video Plucker';
  const appVersion = app.expo.version ?? '4.12.0';
  writeFileSync(
    join(outDir, 'submission.md'),
    [
      `# ${appName} ${appVersion} — F-Droid submission`,
      '',
      'Built with `node scripts/build-fdroid.mjs` (GMS-free, unsigned — F-Droid signs with its own key).',
      '',
      '## f-droid.org submission (GitLab MR)',
      '',
      'Push the source to a public git mirror and file an MR against the F-Droid repo (https://gitlab.com/fdroid/fdroiddata) with `metadata/xyrus.code.ytplucker.yml`:',
      '',
      '```yaml',
      'Categories:',
      '  - Internet',
      'License: MIT',
      'WebSite: https://github.com/XyrusCode/video-plucker-mobile',
      'SourceCode: https://github.com/XyrusCode/video-plucker-v2',
      'IssueTracker: https://github.com/XyrusCode/video-plucker-v2/issues',
      `AutoName: ${appName}`,
      `Name: ${appName}`,
      'Summary: Download videos from YouTube, X, TikTok, Instagram, Facebook, Reddit, VK',
      'Description: |',
      '  Video Plucker is a downloader for YouTube, X/Twitter, TikTok, Instagram,',
      '  Facebook, Reddit and VK. Browse in the built-in browser, pluck any video,',
      '  pick a quality (MP3/M4A up to 4K), and downloads run in the background',
      '  with progress in the notification. Files land in your gallery.',
      `Repo: https://github.com/XyrusCode/video-plucker-v2.git`,
      'Build:',
      `  - versionName: ${appVersion}`,
      '    versionCode: 28',
      `    commit: v${appVersion}`,
      '    gradle: true',
      '    prebuild: |',
      '      node scripts/build-fdroid.mjs',
      `    output: app/build/outputs/apk/release/app-release.apk`,
      'AutoUpdateMode: Version',
      'UpdateCheckMode: Tags',
      '```',
      '',
      'Notes:',
      '- The APK must be built from source by F-Droid\'s infra; commit hashes must match your tag.',
      '- The `EXPO_PUBLIC_STORE=fdroid` env is set by the script; upstream build must pass it too',
      '  (or the updater section will appear — harmless but non-free).',
      '',
    ].join('\n')
  );
  console.log('Done: dist/fdroid/video-plucker-fdroid.apk + dist/fdroid/submission.md');
} catch (err) {
  console.error('F-Droid build failed:', err.message);
  process.exitCode = 1;
} finally {
  restore();
  console.log('package.json / app.json restored.');
}
