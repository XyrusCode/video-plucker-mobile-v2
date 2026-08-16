// Port of V1's Platforms.kt — single source of truth for the supported sites.

export interface SitePlatform {
  name: string;
  homeUrl: string;
  /** Hex color used for the browser card accents. */
  color: string;
  videoPatterns: RegExp[];
  /** Lowercase fragments matched against yt-dlp's extractor key. */
  extractorKeys: string[];
  /** Key used for cookie storage — derived from extractorKeys. */
  cookieKey: string;
  /** URL loaded in the login WebView. */
  loginUrl: string;
  /** Domain passed to CookieManager.getCookie for extraction. */
  cookieDomain: string;
  /** Extra domains that may hold cookies for this platform (VK: vk.ru / vkvideo.ru). */
  cookieDomains: string[];
}

export const SUPPORTED_PLATFORMS: SitePlatform[] = [
  {
    name: 'YouTube',
    homeUrl: 'https://m.youtube.com',
    color: '#FF0000',
    videoPatterns: [
      /(?:[\w-]+\.)?youtube\.\w+\/(?:watch\?v=|shorts\/|live\/|embed\/)[\w-]+/,
      /youtu\.be\/[\w-]+/,
    ],
    extractorKeys: ['youtube'],
    cookieKey: 'youtube',
    loginUrl: 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com',
    cookieDomain: 'https://www.youtube.com',
    cookieDomains: [],
  },
  {
    name: 'X / Twitter',
    homeUrl: 'https://x.com',
    color: '#1DA1F2',
    videoPatterns: [/x\.\w+\/\w+\/status\/\d+/, /twitter\.\w+\/\w+\/status\/\d+/],
    extractorKeys: ['twitter', 'x'],
    cookieKey: 'twitter',
    loginUrl: 'https://x.com/login',
    cookieDomain: 'https://x.com',
    cookieDomains: [],
  },
  {
    name: 'TikTok',
    homeUrl: 'https://www.tiktok.com',
    color: '#25F4EE',
    videoPatterns: [
      /tiktok\.com\/@[\w.-]+\/video\/\d+/,
      /tiktok\.com\/@[\w.-]+\/photo\/\d+/,
      /tiktok\.com\/(?:embed|v)\/\d+/,
      /(?:vm|vt)\.tiktok\.com\/\w+/,
      /tiktok\.com\/t\/\w+/,
    ],
    extractorKeys: ['tiktok'],
    cookieKey: 'tiktok',
    loginUrl: 'https://www.tiktok.com/login',
    cookieDomain: 'https://www.tiktok.com',
    cookieDomains: [],
  },
  {
    name: 'Instagram',
    homeUrl: 'https://www.instagram.com',
    color: '#E4405F',
    videoPatterns: [/instagram\.com\/(?:p|reel|tv)\/[\w-]+/],
    extractorKeys: ['instagram'],
    cookieKey: 'instagram',
    loginUrl: 'https://www.instagram.com/accounts/login/',
    cookieDomain: 'https://www.instagram.com',
    cookieDomains: [],
  },
  {
    name: 'Facebook',
    homeUrl: 'https://www.facebook.com',
    color: '#1877F2',
    videoPatterns: [
      /facebook\.com\/[\w.-]+\/videos\/[\w-]+/,
      /facebook\.com\/watch\/?\?v=\w+/,
      /fb\.watch\/[\w-]+/,
    ],
    extractorKeys: ['facebook', 'fb'],
    cookieKey: 'facebook',
    loginUrl: 'https://www.facebook.com/login/',
    cookieDomain: 'https://www.facebook.com',
    cookieDomains: [],
  },
  {
    name: 'Reddit',
    homeUrl: 'https://www.reddit.com',
    color: '#FF4500',
    videoPatterns: [/reddit\.com\/r\/[\w-]+\/comments\/[\w-]+/, /redd\.it\/[\w-]+/],
    extractorKeys: ['reddit'],
    cookieKey: 'reddit',
    loginUrl: 'https://www.reddit.com/login/',
    cookieDomain: 'https://www.reddit.com',
    cookieDomains: [],
  },
  {
    name: 'VK',
    homeUrl: 'https://vk.com',
    color: '#0077FF',
    videoPatterns: [
      /vk\.com\/video-?\d+_\d+/,
      /vk\.ru\/video-?\d+_\d+/,
      /vkvideo\.ru\/video-?\d+_\d+/,
      /vk\.com\/clip-?\d+_\d+/,
      /vk\.ru\/clip-?\d+_\d+/,
      /vkvideo\.ru\/clip-?\d+_\d+/,
      // Any other vkvideo.ru page is still VK content — needed so cookie/gallery
      // lookups and failure guidance apply to unusual URL shapes too.
      /vkvideo\.ru\//,
    ],
    extractorKeys: ['vk'],
    cookieKey: 'vk',
    loginUrl: 'https://vk.com/login',
    cookieDomain: 'https://vk.com',
    cookieDomains: ['https://vk.ru', 'https://vkvideo.ru'],
  },
];

export function platformForCookieKey(key: string): SitePlatform | undefined {
  return SUPPORTED_PLATFORMS.find((p) => p.cookieKey === key);
}

export function platformForVideoUrl(url: string): SitePlatform | undefined {
  return SUPPORTED_PLATFORMS.find((p) => p.videoPatterns.some((re) => re.test(url)));
}

export function platformForExtractorKey(key: string): SitePlatform | undefined {
  const k = key.toLowerCase();
  return (
    SUPPORTED_PLATFORMS.find((p) => p.extractorKeys.some((ek) => ek === k)) ??
    SUPPORTED_PLATFORMS.find((p) => p.extractorKeys.some((ek) => ek.length > 1 && k.includes(ek)))
  );
}

const TIKTOK_HOST = /^(https?:\/\/)(?:m\.|www\.)?tiktok\.com\//i;
const TIKTOK_VIDEO_QUERY = /^(https?:\/\/[\w.]*tiktok\.com\/@[\w.-]+\/video\/\d+)\?.*$/i;
const TIKTOK_PHOTO_QUERY = /^(https?:\/\/[\w.]*tiktok\.com\/@[\w.-]+\/photo\/\d+)\?.*$/i;

export const TIKTOK_PHOTO_MSG =
  'TikTok photo/slideshow posts require Image quality — switch to Image and try again.';

/**
 * Canonicalise a URL for yt-dlp: force literal `www.` on TikTok (its extractor demands it)
 * and strip all query params from /@user/video/<id> (tracking params trigger impersonator
 * / sign-in warnings). Short links (vm./vt./t/) are left alone.
 */
export function normalizeForEngine(url: string): string {
  const normalized = url.replace(TIKTOK_HOST, '$1www.tiktok.com/');
  const noVideoQuery = normalized.replace(TIKTOK_VIDEO_QUERY, '$1');
  return noVideoQuery.replace(TIKTOK_PHOTO_QUERY, '$1');
}

const TIKTOK_PHOTO_PATH = /tiktok\.com\/@[\w.-]+\/photo\/\d+/i;

/** True if [url] is a TikTok photo/slideshow post (/@user/photo/<id>). */
export function isTikTokPhotoUrl(url: string): boolean {
  return TIKTOK_PHOTO_PATH.test(url);
}

// --- In-app browser URL handling ------------------------------------------------------------

/** True for schemes a WebView can actually load. */
export function isWebUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

// `;` belongs in both halves: intent:// packs its extras as `#Intent;a=1;b=2;end`.
const APP_LINK_FALLBACK = /[?&#;](?:params_url|S\.browser_fallback_url|browser_fallback_url)=([^&#;]+)/i;

/** The plain web URL hidden inside an app deep-link, or null if it carries none. */
export function webFallbackFromAppLink(url: string): string | null {
  const match = APP_LINK_FALLBACK.exec(url);
  if (!match) return null;
  let decoded: string | null = null;
  try {
    decoded = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return decoded && isWebUrl(decoded) ? decoded : null;
}