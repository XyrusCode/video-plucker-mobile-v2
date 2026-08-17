# Changelog

All notable changes to Video Plucker (Android) are documented in this file.

## [4.12.0] - 2026-08-17

### Changed

- React Native build becomes the official release, continuing the original app's versioning (4.12.0, version code 28) with the same package id and signing key — 4.12 installs directly over 4.11.
- The Kotlin/Compose app is deprecated (archived repo); all development moves here.
- Release signing now uses the original committed keystore (`keystore/ytplucker.jks`).
- Branding: black + blue instead of black + YouTube red (launcher, theme accent #3B82F6).
- Browser is no longer optional/experimental — it is a first-class, always-on tab.
- Credentials carried over from the original app: Firebase (project `ytplucker`) and Sentry (org `xyrus-code`, project `video-plucker`), including CI source-map uploads.
- Self-updater now honors the `updates_enabled` Remote Config flag; store builds (F-Droid) hide the in-app updater.
- Cookies persist to the app's files dir instead of cache (survive cache clears).

### Fixed

- **Analyze (probe) crash** — `call to function YTPluck.probeAsync rejected`: probes now ensure the engine is initialized, normalize URLs like downloads do, self-heal (update yt-dlp + retry) on stale-engine errors, and surface the real error message instead of a bare rejection.
- **Engine boot failure poisoning** — a failed first-launch boot is retried on the next launch instead of permanently marking the engine as booted.
- **Cookie Manager "save" did nothing** — "Done — save my cookies" now actually exports the login session to a durable file, stores it, and confirms in the UI; YouTube cookies are collected from both `www.` and `m.` origins.
- **No way to report errors from the app** — added a Report button to analyze/download errors and a Report-an-issue row in Settings (pre-filled GitHub issues).
- **Browser chrome missing** — restored the V1-style "Where to?" landing, address bar with Go, platform quick links, and auto-hiding chrome.

### Added

- One-time permissions step in the walkthrough: notifications, camera (QR sign-in), and "Allow app installs" for self-updates.
- F-Droid build script (`scripts/build-fdroid.mjs`) producing a GMS-free, unsigned APK.

## [2.0.0] - 2026-08-16

### Added

- Complete rewrite on React Native + Expo SDK 57 (Kotlin native module for the yt-dlp engine).
- Built-in browser tab with a floating Pluck button on supported video pages.
- Paste/analyze/download tab with per-platform remembered quality.
- Quality ladder: Best, 4K, 2K, 1080p, 720p, 480p, Image (TikTok photos), MP3, M4A.
- Background downloads via foreground service: progress notification, pause/resume/cancel, resume after crash.
- Queue tab with live progress, speed, ETA, and per-job controls.
- History tab reading the device media gallery ("Video Plucker" album), with open + dismiss.
- Cookie Manager: per-platform login (WebView) or cookies.txt import; sessions exported to yt-dlp automatically.
- Support for YouTube, X/Twitter, TikTok, Instagram, Facebook, Reddit, and VK (vk.com / vk.ru / vkvideo.ru).
- Self-update checker (GitHub releases) with in-app download + install.
- Android share target and deep links (`yt-plucker://`) with startup race handling.
- Android TV support (leanback launcher).
- Firebase Remote Config feature flags with code-level defaults.
- Sentry crash reporting (optional, via build-time DSN).
- CI: debug builds on every push/PR, per-ABI + universal release APKs mirrored to Cloudflare R2.
