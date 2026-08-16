// Cookie resolution: pull the login session out of the system WebView cookie store and hand
// yt-dlp a real Netscape cookies.txt file. Mirrors V1's resolveCookies + Netscape writer.

import YtPluckModule from 'yt-pluck';
import { usePrefs } from '../stores/prefs';
import { platformForVideoUrl, type SitePlatform } from './platforms';

/** Raw CookieManager value for a URL (no expiry/domain attributes in the WebView's output). */
function rawCookieFor(platform: SitePlatform, domain: string): string | null {
  return YtPluckModule.getCookiesAsync(domain);
}

/**
 * Netscape-format line for a single cookie. WebView cookies carry no per-cookie expiry, so we
 * write a far-future one (yt-dlp accepts it). Domain gets a leading dot so it matches
 * subdomains; paths are emitted as '/' (WebView returns the path as a separate segment).
 */
function netscapeLine(domain: string, cookie: string): string {
  const sep = cookie.indexOf('=');
  if (sep <= 0) return '';
  const name = cookie.slice(0, sep);
  const value = cookie.slice(sep + 1);
  const dotDomain = domain.startsWith('.') ? domain : `.${domain}`;
  const hostOnly = dotDomain.startsWith('.') ? 'TRUE' : 'FALSE';
  return [
    dotDomain,
    hostOnly,
    '/',
    'TRUE',
    '4102444800', // 2100-01-01
    name,
    value,
  ].join('\t');
}

function domainHost(url: string): string {
  return url.replace(/^https?:\/\//i, '').split('/')[0];
}

/**
 * Resolve the cookies yt-dlp should use for [url]. Returns the absolute path to a cookies
 * file, or null when the user has no session for the platform.
 *
 * 1. An imported cookies.txt (Cookie Manager) wins — it's already on disk at a real path.
 * 2. Otherwise the WebView session is exported to a temp Netscape file.
 *
 * VK spans three hosts (vk.com / vk.ru / vkvideo.ru) — cookies are collected from every
 * domain so a vkvideo.ru URL gets matching cookies too.
 */
export async function resolveCookiesFile(url: string): Promise<string | null> {
  const platform = platformForVideoUrl(url);
  if (!platform) return null;

  const imported = usePrefs.getState().importedCookies[platform.cookieKey];
  if (imported) return imported.path;

  const domains = [platform.cookieDomain, ...platform.cookieDomains];
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const domain of domains) {
    const host = domainHost(domain);
    const raw = rawCookieFor(platform, domain);
    if (!raw) continue;
    for (const cookie of raw.split(';')) {
      const trimmed = cookie.trim();
      if (!trimmed) continue;
      const line = netscapeLine(host, trimmed);
      if (line && !seen.has(line)) {
        seen.add(line);
        lines.push(line);
      }
    }
  }
  if (lines.length === 0) return null;

  const header = '# Netscape HTTP Cookie File\n# Manually exported from Video Plucker\n';
  const file = await YtPluckModule.saveCookiesFileAsync(platform.cookieKey, header + lines.join('\n') + '\n');
  return file;
}

/**
 * Persist an imported cookies.txt under the platform's cookie key. The file lands in the app's
 * cache dir (not device-visible) and takes precedence over the WebView session export.
 */
export async function saveImportedCookies(platformKey: string, text: string): Promise<string> {
  const path = await YtPluckModule.saveCookiesFileAsync(platformKey, text);
  if (!path) throw new Error('Could not write the cookies file');
  return path;
}