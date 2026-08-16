import { create } from 'zustand';

interface SharedUrlState {
  /** URL waiting to be analyzed (from browser Pluck button / share sheet / deep link). */
  url: string | null;
  /** Bumped on every set so the Download tab can react to repeat URLs. */
  nonce: number;
  setSharedUrl: (url: string | null) => void;
}

export const useSharedUrl = create<SharedUrlState>()((set) => ({
  url: null,
  nonce: 0,
  setSharedUrl: (url) => set((s) => ({ url, nonce: s.nonce + 1 })),
}));