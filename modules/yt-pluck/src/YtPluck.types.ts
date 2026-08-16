// Types shared between the JS layer and the native YtPluck module.

/** Quality options — mirror the V1/desktop dropdown 1:1. */
export type QualityId =
  | 'best'
  | '2160'
  | '1440'
  | '1080'
  | '720'
  | '480'
  | 'image'
  | 'mp3'
  | 'm4a';

/** States for a single download job. */
export type JobStatus =
  | 'RUNNING'
  | 'QUEUED'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/** Metadata returned by an "Analyze" probe (yt-dlp getInfo). */
export interface ProbeResult {
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  uploader: string | null;
  /** yt-dlp extractor key, e.g. "Youtube", "Twitter". */
  source: string | null;
  availableHeights: number[];
}

/** A snapshot of a download's progress, emitted from native. */
export interface DownloadProgressEvent {
  jobId: string;
  title: string;
  /** 0..100 */
  percent: number;
  /** bytes/s, -1 when unknown */
  speedBytesPerSec: number;
  /** -1 when unknown */
  etaSeconds: number;
  status: JobStatus;
  error?: string | null;
  url: string;
}

/** A file this app has downloaded, as seen in MediaStore (backing the History tab). */
export interface DownloadedFile {
  uri: string;
  name: string;
  mime: string;
  sizeBytes: number;
  dateAddedSec: number;
}

/** Payload of the shared-url event (share sheet / deep link arrival). */
export interface SharedUrlEvent {
  url: string;
}