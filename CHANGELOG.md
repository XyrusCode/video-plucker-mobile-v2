# Changelog

All notable changes to Video Plucker V2 (Android) are documented in this file.

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