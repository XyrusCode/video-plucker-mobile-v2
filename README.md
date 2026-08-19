# Video Plucker (mobile-v2)

Video downloader for Android — YouTube, X/Twitter, TikTok, Instagram, Facebook, Reddit and VK. Browse in the built-in browser, pluck any video, pick a quality (MP3/M4A up to 4K), and downloads run in the background with progress in the notification. Files land in your gallery.

React Native + Expo SDK 57, with a Kotlin native module wrapping the yt-dlp engine.

## Releases

Built and published by GitLab CI for every `v*` tag. Download the latest `app-universal-release.apk` from the [Releases page](https://gitlab.com/XyrusCode/video-plucker-mobile-v2/-/releases) (installable over older builds — same package id and signing key).

## Development

Requires Node 22. Builds run in GitLab CI; you can also build locally:

```sh
npm ci
npx expo prebuild --platform android   # generates android/ (keystore-backed signing via plugins/withYtPluckAndroid.js)
cd android && ./gradlew assembleRelease
```

- Package id: `xyrus.code.ytplucker`
- Release signing uses the committed keystore `keystore/ytplucker.jks` (alias/password `ytplucker`)
- F-Droid flavor: `node scripts/build-fdroid.mjs` (GMS-free, unsigned)
- CI config: `.gitlab-ci.yml` — debug build on `main`, signed release + GitLab Release on `v*` tags

## Reporting issues

All in-app error/crash reporting goes to Sentry (org `xyrus-code`, project `video-plucker`)
— analysis failures, download failures and "Report an issue" presses are captured there
automatically. For anything Sentry can't capture, use the [GitLab issue tracker](https://gitlab.com/XyrusCode/video-plucker-mobile-v2/-/issues) — see [CONTRIBUTING.md](CONTRIBUTING.md) for what's most useful.

## History

Originally the Kotlin/Compose app (`video-plucker-android`, archived); rewritten on React Native and continued here as the official build since 4.12.0. See [CHANGELOG.md](CHANGELOG.md).
