# Contributing to Video Plucker

Thanks for helping! Everything lives on GitLab: https://gitlab.com/KyriosNyx/video-plucker-mobile-v2

## Reporting bugs

Open an issue at https://gitlab.com/KyriosNyx/video-plucker-mobile-v2/-/issues and include:

1. **App version** (Settings → About) and Android version/device.
2. **The exact URL** that failed.
3. **The full error text** — tap Report on the error screen; it pre-fills version, URL, error and raw detail. Paste that into the issue.
4. Steps to reproduce.

## Development setup

- Node 22; Android builds run in GitLab CI (`.gitlab-ci.yml`) — no local SDK needed for verification.
- Local build: `npm ci && npx expo prebuild --platform android && cd android && ./gradlew assembleRelease`
- Typecheck: `npx tsc --noEmit`
- Style: prettier defaults; no comments unless they earn their place; match surrounding code.

## Branch flow

- `main` is the release branch — CI runs a debug build on every push.
- Work in short-lived branches, open a merge request to `main`.
- No commit conventions required, but keep commits focused and message bodies factual.

## Releases

1. Update `CHANGELOG.md` (top section `## [x.y.z] - YYYY-MM-DD`), bump `version` + `versionCode` in `app.json`.
2. Tag and push: `git tag v5.0.0-beta && git push origin v5.0.0-beta`
3. The `release` CI job builds the signed APK, publishes it to the generic package registry, and creates the GitLab Release with the CHANGELOG section as notes.
4. Install the release APK and smoke-test: analyze + download on YouTube and at least one "tricky" platform (TikTok, X), share-sheet landing, queue progress, gallery export, self-update prompt.

## Notes

- The project must stay **public** (or at least releases/packages public) so the in-app self-update and issue links work without login.
- The old GitHub mirror (`XyrusCode/video-plucker-mobile-v2`) is read-only; don't push there.
