# TODO

## After the successful release of 5.0.0-beta

- [x] Reduce APK sizes back to the smaller per-device (per-ABI) builds used in the old repo, instead of the current universal APK. (Per-ABI splits are the default; `-PnoAbiSplits` still emits the universal APK for the in-app updater + website links.)