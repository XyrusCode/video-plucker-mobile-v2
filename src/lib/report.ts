// Error reporting — failures go to both Sentry (if configured) and GitHub Issues.
// User-initiated reports always open a pre-filled GitHub issue URL (no token needed).
// Auto-reports use the GitHub API when a token is available, or Sentry as fallback.

import * as Sentry from '@sentry/react-native';
import * as Application from 'expo-application';
import { Alert, Linking } from 'react-native';
import { createGitHubIssue } from './github-issues';

const REPO = 'XyrusCode/video-plucker-mobile-v2';

const appVersion = (): string => Application.nativeApplicationVersion ?? 'unknown';

/** URL-encode for GitHub issue query params. */
function encodeIssueParam(s: string): string {
  return encodeURIComponent(s).replace(/%20/g, '+').replace(/%0A/g, '%0A');
}

/** Build a pre-filled GitHub issue URL (works without any token). */
function githubIssueUrl(title: string, body: string, labels: string[] = ['bug']): string {
  const params = new URLSearchParams({
    title,
    body,
    labels: labels.join(','),
  });
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}

/**
 * Fire an error report. Best-effort; never throws.
 *
 * - Auto-reports (background failures): sent to Sentry if configured, otherwise silently
 *   queued. No GitHub issue is created automatically to avoid spam.
 * - User-initiated reports ("Report" button): opens a pre-filled GitHub issue URL in the
 *   browser so the user can submit it with one tap.
 */
export async function reportFailure(params: {
  title: string;
  body: string;
  url?: string;
  userInitiated?: boolean;
}): Promise<boolean> {
  const fullBody = [
    params.body,
    '---',
    `**App version:** ${appVersion()}`,
    params.url ? `**URL:** ${params.url}` : '',
  ].filter(Boolean).join('\n');

  // --- User-initiated: open GitHub issue URL ---
  if (params.userInitiated) {
    const issueUrl = githubIssueUrl(params.title, fullBody);
    Alert.alert(
      'Report issue',
      'This will open a GitHub issue with the error details pre-filled.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open GitHub',
          onPress: () => Linking.openURL(issueUrl),
        },
      ],
    );
    return true;
  }

  // --- Auto-report: Sentry if configured ---
  try {
    if (Sentry.getClient()) {
      Sentry.captureMessage(params.title, {
        level: 'error',
        tags: { source: 'auto' },
        extra: {
          appVersion: appVersion(),
          url: params.url ?? '',
          detail: params.body,
        },
      });
      return true;
    }
  } catch {
    // swallow
  }

  // --- Auto-report: GitHub API if token configured ---
  if (process.env.EXPO_PUBLIC_GITHUB_TOKEN) {
    try {
      const url = await createGitHubIssue({
        title: params.title,
        body: fullBody,
        labels: ['bug', 'auto-report'],
      });
      return url !== null;
    } catch {
      // swallow
    }
  }

  return false;
}

/**
 * Fire a user-initiated "Report an issue" (Settings → About).
 * Opens a pre-filled GitHub issue URL directly.
 */
export function reportUserIssue(): void {
  const body = [
    '**User-reported issue from Settings → About**',
    '',
    `**App version:** ${appVersion()}`,
    '',
    '**Describe the issue:**',
    '<!-- What happened? What did you expect? -->',
  ].join('\n');

  const issueUrl = githubIssueUrl(`User issue: v${appVersion()}`, body);
  Alert.alert(
    'Report issue',
    'This will open a GitHub issue where you can describe the problem.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open GitHub',
        onPress: () => Linking.openURL(issueUrl),
      },
    ],
  );
}
