/**
 * withYtPluckAndroid — Android config plugin for Video Plucker V2.
 *
 * Applies the V1 app's native manifest/build requirements on top of the Expo prebuild output:
 *  1. Manifest: leanback/TV + touchscreen feature flags, legacy storage permission (maxSdk 28),
 *     extractNativeLibs on the application, and a SEND (share-target) intent-filter on
 *     MainActivity so the app appears in the Android share sheet.
 *  2. Build: legacy packaging so the bundled yt-dlp native libs (Python payloads) stay as
 *     files. A single universal APK is produced (the template bundles all ABIs); the
 *     `isUniversalApk` abi-split option was removed in newer AGP/Gradle 9 toolchains.
 */
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const LEANBACK = 'android.software.leanback';
const TOUCHSCREEN = 'android.hardware.touchscreen';

const GRADLE_BLOCK = `
// Added by withYtPluckAndroid (Video Plucker V2)
android {
  packaging {
    jniLibs {
      useLegacyPackaging = true
    }
  }
}
`;

function withManifestMods(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    // ---- uses-feature flags (TV leanback support, like V1) ----
    const features = (app['uses-feature'] = app['uses-feature'] || []);
    for (const name of [LEANBACK, TOUCHSCREEN]) {
      if (!features.some((f) => f.$ && f.$['android:name'] === name)) {
        features.push({ $: { 'android:name': name, 'android:required': 'false' } });
      }
    }

    // ---- legacy external-storage permission (Android ≤ 8.1, maxSdk 28) ----
    const permissions = (manifest.manifest['uses-permission'] =
      manifest.manifest['uses-permission'] || []);
    if (
      !permissions.some(
        (p) => p.$ && p.$['android:name'] === 'android.permission.WRITE_EXTERNAL_STORAGE'
      )
    ) {
      permissions.push({
        $: {
          'android:name': 'android.permission.WRITE_EXTERNAL_STORAGE',
          'android:maxSdkVersion': '28',
        },
      });
    }

    // ---- extractNativeLibs so yt-dlp's packaged .so payloads stay as files ----
    app.$ = app.$ || {};
    app.$['android:extractNativeLibs'] = 'true';

    // ---- share-target: appear in the Android share sheet for text/plain ----
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    const filters = (mainActivity['intent-filter'] = mainActivity['intent-filter'] || []);
    const isShareFilter = (f) =>
      Array.isArray(f.action) &&
      f.action.some((a) => a.$['android:name'] === 'android.intent.action.SEND');
    if (!filters.some(isShareFilter)) {
      mainActivity['intent-filter'].push({
        action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: [{ $: { 'android:mimeType': 'text/plain' } }],
      });
    }

    return config;
  });
}

function withGradleMods(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const gradlePath = path.join(config.modRequest.platformProjectRoot, 'app', 'build.gradle');
      const content = fs.readFileSync(gradlePath, 'utf8');
      if (!content.includes('withYtPluckAndroid')) {
        fs.appendFileSync(gradlePath, GRADLE_BLOCK);
      }
      return config;
    },
  ]);
}

module.exports = function withYtPluckAndroid(config) {
  config = withManifestMods(config);
  config = withGradleMods(config);
  return config;
};