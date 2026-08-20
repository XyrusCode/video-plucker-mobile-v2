/**
 * withYtPluckAndroid — Android config plugin for Video Plucker V2.
 *
 * Applies the V1 app's native manifest/build requirements on top of the Expo prebuild output:
 *  1. Manifest: leanback/TV + touchscreen feature flags, legacy storage permission (maxSdk 28),
 *     extractNativeLibs on the application, and a SEND (share-target) intent-filter on
 *     MainActivity so the app appears in the Android share sheet.
 *  2. Build: legacy packaging so the bundled yt-dlp native libs (Python payloads) stay as
 *     files, plus per-ABI splits (arm64-v8a, armeabi-v7a, x86_64) like V1. Passing
 *     `-PnoAbiSplits` to gradle disables the splits so a single universal APK is emitted
 *     (the `universalApk` abi-split option was removed in newer AGP/Gradle 9 toolchains).
 */
const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const LEANBACK = 'android.software.leanback';
const TOUCHSCREEN = 'android.hardware.touchscreen';

// The F-Droid build must ship unsigned (F-Droid signs with their own key) and without Google
// services; the env var is set by scripts/build-fdroid.mjs.
const IS_FDROID = process.env.EXPO_PUBLIC_STORE === 'fdroid';

const GRADLE_BLOCK = `
// Added by withYtPluckAndroid (Video Plucker V2)
def enableAbiSplits = project.hasProperty('abiSplits')
android {
  packaging {
    jniLibs {
      useLegacyPackaging = true
    }
  }
  if (enableAbiSplits) {
    splits {
      abi {
        enable true
        reset()
        include 'arm64-v8a', 'armeabi-v7a', 'x86_64'
      }
    }
  }
}
`;

// Shared release key, straight from the original Android app (keystore/ytplucker.jks). Keeping
// the same key + package id lets 4.12 install directly over the original 4.11 builds.
const SIGNING_BLOCK = `
// Added by withYtPluckAndroid (release signing)
android {
  signingConfigs {
    release {
      storeFile rootProject.file('keystore/ytplucker.jks')
      storePassword 'ytplucker'
      keyAlias 'ytplucker'
      keyPassword 'ytplucker'
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
    }
  }
}
`;

function withManifestMods(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    // ---- uses-feature flags (TV leanback support, like V1) ----
    // NOTE: uses-feature lives at manifest ROOT level, not on <application>.
    const features = (manifest.manifest['uses-feature'] = manifest.manifest['uses-feature'] || []);
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

/**
 * Copy the committed release keystore into the generated project (android/keystore/) and sign
 * release builds with it, replacing the template's debug-key signing. Skipped for F-Droid.
 */
function withReleaseSigning(config) {
  if (IS_FDROID) return config;

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const src = path.join(config.modRequest.projectRoot, 'keystore', 'ytplucker.jks');
      const destDir = path.join(config.modRequest.platformProjectRoot, 'keystore');
      const dest = path.join(destDir, 'ytplucker.jks');
      if (fs.existsSync(src) && !fs.existsSync(dest)) {
        fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(src, dest);
      }
      return config;
    },
  ]);

  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes('withYtPluckAndroid (release signing)')) return config;
    return {
      ...config,
      modResults: { ...config.modResults, contents: contents + SIGNING_BLOCK },
    };
  });
}

module.exports = function withYtPluckAndroid(config) {
  config = withManifestMods(config);
  config = withGradleMods(config);
  config = withReleaseSigning(config);
  return config;
};