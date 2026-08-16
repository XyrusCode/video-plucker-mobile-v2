import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { QualityId } from 'yt-pluck';

export const TERMS_VERSION = 1;

interface PrefsState {
  /** Has the user accepted the (static) terms? Gates Terms → Walkthrough → app. */
  acceptedTerms: boolean;
  /** Has the user seen the walkthrough? */
  walkthroughDone: boolean;
  /** History entries the user dismissed (MediaStore content URIs). */
  dismissedUris: string[];
  /** Last quality chosen per platform (cookie key), remembered across sessions. */
  lastQuality: Record<string, QualityId>;
  /** Imported cookies.txt files per platform cookie key: absolute path + when imported. */
  importedCookies: Record<string, { path: string; importedAt: number }>;
  /** True once the initial engine boot (Python + yt-dlp self-update) has been triggered. */
  engineBooted: boolean;

  acceptTerms: () => void;
  finishWalkthrough: () => void;
  dismissUri: (uri: string) => void;
  rememberQuality: (platformKey: string, quality: QualityId) => void;
  setImportedCookies: (platformKey: string, path: string) => void;
  clearImportedCookies: (platformKey: string) => void;
  markEngineBooted: () => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      acceptedTerms: false,
      walkthroughDone: false,
      dismissedUris: [],
      lastQuality: {},
      importedCookies: {},
      engineBooted: false,

      acceptTerms: () => set({ acceptedTerms: true }),
      finishWalkthrough: () => set({ walkthroughDone: true }),
      dismissUri: (uri) =>
        set((s) => ({
          dismissedUris: s.dismissedUris.includes(uri) ? s.dismissedUris : [...s.dismissedUris, uri],
        })),
      rememberQuality: (platformKey, quality) =>
        set((s) => ({ lastQuality: { ...s.lastQuality, [platformKey]: quality } })),
      setImportedCookies: (platformKey, path) =>
        set((s) => ({
          importedCookies: {
            ...s.importedCookies,
            [platformKey]: { path, importedAt: Date.now() },
          },
        })),
      clearImportedCookies: (platformKey) =>
        set((s) => {
          const { [platformKey]: _, ...rest } = s.importedCookies;
          return { importedCookies: rest };
        }),
      markEngineBooted: () => set({ engineBooted: true }),
    }),
    {
      name: 'ytplucker.v2.prefs',
      storage: createJSONStorage(() => AsyncStorage),
      version: TERMS_VERSION,
      migrate: (persisted) => persisted as PrefsState,
    }
  )
);