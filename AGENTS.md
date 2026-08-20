# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Build versioning policy (MANDATORY)

Every build that goes out bumps the **patch** version by exactly one unless the user
explicitly states it's a **major** or **minor** release. Android uses `versionCode` to decide
whether an install is an update, so shipping the same version twice makes Android treat the
APK as a reinstall of the same version.

- Default: `X.Y.Z` → `X.Y.(Z+1)` (e.g. `5.1.0` → `5.1.1`).
- Minor: `X.Y.Z` → `X.(Y+1).0` — only when the user says "minor release".
- Major: `X.Y.Z` → `(X+1).0.0` — only when the user says "major release".

Bump BOTH in sync before every build:
- `app.json` → `expo.version` (user-facing versionName) and `expo.android.versionCode`.
- `eas.json` uses `cli.appVersionSource: "remote"` + `autoIncrement: true` on the preview and
  production profiles, so EAS keeps the remote `versionCode` auto-incrementing per build on top
  of the manual `version` bump. `autoIncrement` only covers the developer-facing build version;
  the user-facing `version` in `app.json` is always bumped manually per this policy.