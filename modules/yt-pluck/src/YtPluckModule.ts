import { requireNativeModule } from 'expo';
import { NativeModule, type EventSubscription } from 'expo-modules-core';
import type {
  DownloadProgressEvent,
  DownloadedFile,
  ProbeResult,
  QualityId,
  SharedUrlEvent,
} from './YtPluck.types';

declare class YtPluckNativeModule extends NativeModule<{
  downloadProgress: (event: DownloadProgressEvent) => void;
  sharedUrl: (event: SharedUrlEvent) => void;
}> {
  initEngineAsync(): Promise<boolean>;
  updateEngineAsync(): Promise<boolean>;
  probeAsync(url: string): Promise<
    ProbeResult & { ok?: boolean; error?: string }
  >;
  startDownloadAsync(
    url: string,
    qualityId: QualityId,
    cookiesPath: string | null
  ): Promise<string | null>;
  pauseDownloadAsync(jobId: string): void;
  resumeDownloadAsync(jobId: string): void;
  cancelDownloadAsync(jobId: string): void;
  getCookiesAsync(url: string): string | null;
  saveCookiesFileAsync(
    key: string,
    cookieLines: string,
    kind: 'session' | 'imported' | 'temp'
  ): Promise<string | null>;
  queryHistoryAsync(): Promise<DownloadedFile[]>;
  getInitialSharedUrl(): string | null;
}

const YtPluckModule = requireNativeModule<YtPluckNativeModule>('YtPluck');

/** Subscribe to download progress updates. Returns an unsubscribe function. */
export function addDownloadProgressListener(
  listener: (event: DownloadProgressEvent) => void
): EventSubscription {
  return YtPluckModule.addListener('downloadProgress', listener);
}

/** Subscribe to share-sheet / deep-link URL arrivals. Returns an unsubscribe function. */
export function addSharedUrlListener(
  listener: (event: SharedUrlEvent) => void
): EventSubscription {
  return YtPluckModule.addListener('sharedUrl', listener);
}

export default YtPluckModule;

export type { EventSubscription };