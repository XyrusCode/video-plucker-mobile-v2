import { create } from 'zustand';
import YtPluckModule from 'yt-pluck';
import type { DownloadedFile } from 'yt-pluck';
import { usePrefs } from './prefs';

interface HistoryState {
  items: DownloadedFile[];
  loading: boolean;
  error: string | null;
  lastRefresh: number;
  refresh: () => Promise<void>;
}

export const useHistory = create<HistoryState>()((set) => ({
  items: [],
  loading: false,
  error: null,
  lastRefresh: 0,
  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const all = await YtPluckModule.queryHistoryAsync();
      const dismissed = new Set(usePrefs.getState().dismissedUris);
      set({ items: all.filter((f) => !dismissed.has(f.uri)), loading: false, lastRefresh: Date.now() });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Failed to load history' });
    }
  },
}));