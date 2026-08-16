// Firebase Remote Config, with code-level defaults (V1's FeatureFlags pattern). A missing
// google-services.json or a fetch failure degrades silently to the defaults.

import {
  fetchAndActivate,
  getBoolean,
  getRemoteConfig,
  type RemoteConfig,
} from '@react-native-firebase/remote-config';

const DEFAULTS: Record<string, boolean | number | string> = {
  updates_enabled: true,
  engine_update_enabled: true,
};

let rc: RemoteConfig | null = null;

export async function initRemoteConfig(): Promise<void> {
  if (rc) return;
  try {
    rc = getRemoteConfig();
    rc.defaultConfig = DEFAULTS;
    await fetchAndActivate(rc);
  } catch {
    // No firebase config in this build — defaults apply.
  }
}

export function getFlag(name: string): boolean {
  const fallback = DEFAULTS[name];
  if (typeof fallback !== 'boolean') return true;
  if (!rc) return fallback;
  try {
    return getBoolean(rc, name);
  } catch {
    return fallback;
  }
}