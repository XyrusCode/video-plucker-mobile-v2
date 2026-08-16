// Quality ladder — mirrors the V1/desktop dropdown 1:1 (audio-only through 4K + Image).

import type { QualityId } from 'yt-pluck';

export interface Quality {
  id: QualityId;
  label: string;
  /** yt-dlp -f selector. */
  format: string;
  /** Extra args appended for this quality. */
  extraArgs: string[];
}

export const QUALITIES: Quality[] = [
  { id: 'best', label: 'Best', format: 'bestvideo+bestaudio', extraArgs: [] },
  { id: '2160', label: '4K', format: 'bestvideo[height<=2160]+bestaudio', extraArgs: [] },
  { id: '1440', label: '2K', format: 'bestvideo[height<=1440]+bestaudio', extraArgs: [] },
  { id: '1080', label: '1080p', format: 'bestvideo[height<=1080]+bestaudio', extraArgs: [] },
  { id: '720', label: '720p', format: 'bestvideo[height<=720]+bestaudio', extraArgs: [] },
  { id: '480', label: '480p', format: 'bestvideo[height<=480]+bestaudio', extraArgs: [] },
  {
    id: 'image',
    label: 'Image',
    format: 'best',
    extraArgs: ['--extractor-args', 'tiktok:media_type=image', '--write-thumbnail'],
  },
  { id: 'mp3', label: 'MP3', format: 'bestaudio', extraArgs: ['-x', '--audio-format', 'mp3'] },
  { id: 'm4a', label: 'M4A', format: 'bestaudio', extraArgs: ['-x', '--audio-format', 'm4a'] },
];

export function qualityById(id: QualityId): Quality {
  return QUALITIES.find((q) => q.id === id) ?? QUALITIES[0];
}

/** Video qualities (everything except Image and audio). */
export const VIDEO_QUALITIES = QUALITIES.filter(
  (q) => q.id !== 'image' && q.id !== 'mp3' && q.id !== 'm4a'
);

/** Best-known height for a quality id, used for "up to X" labels. */
export function qualityHeightLabel(id: QualityId): string {
  switch (id) {
    case 'best':
      return 'Best available';
    case '2160':
      return 'Up to 2160p';
    case '1440':
      return 'Up to 1440p';
    case '1080':
      return 'Up to 1080p';
    case '720':
      return 'Up to 720p';
    case '480':
      return 'Up to 480p';
    case 'image':
      return 'Image only';
    case 'mp3':
      return 'MP3 audio';
    case 'm4a':
      return 'M4A audio';
  }
  return 'Best available';
}