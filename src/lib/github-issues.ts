// GitHub Issues reporter — creates issues directly via the GitHub REST API.
// Used alongside Sentry for user-initiated reports and critical download/analysis failures.

import * as Application from 'expo-application';
import { Platform } from 'react-native';

const REPO = 'XyrusCode/video-plucker-mobile-v2';
const API = 'https://api.github.com';

const GITHUB_TOKEN = process.env.EXPO_PUBLIC_GITHUB_TOKEN;

function appVersion(): string {
  return Application.nativeApplicationVersion ?? 'unknown';
}

function deviceInfo(): string {
  return `${Platform.OS} ${Platform.Version}`;
}

/**
 * Create a GitHub issue. Returns the issue URL on success, null on failure.
 * Best-effort — never throws.
 */
export async function createGitHubIssue(params: {
  title: string;
  body: string;
  labels?: string[];
}): Promise<string | null> {
  if (!GITHUB_TOKEN) return null;
  try {
    const res = await fetch(`${API}/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: params.title,
        body: [
          params.body,
          '---',
          `**App version:** ${appVersion()}`,
          `**Device:** ${deviceInfo()}`,
          `**Platform:** Android`,
        ].join('\n'),
        labels: params.labels ?? ['bug', 'auto-report'],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data as { html_url?: string }).html_url ?? null;
  } catch {
    return null;
  }
}
