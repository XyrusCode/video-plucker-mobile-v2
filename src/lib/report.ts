// Error reporting — all failures and crashes go to Sentry (org `xyrus-code`, project
// `video-plucker`). There are no GitHub/GitLab issue links anymore: analysis failures,
// download failures and manual "Report an issue" presses are captured as Sentry events,
// which keeps issue tracking + bug tracking in one place.

import * as Sentry from '@sentry/react-native';
import * as Application from 'expo-application';

const appVersion = (): string => Application.nativeApplicationVersion ?? 'unknown';

/** Fire an error report to Sentry. Best-effort; never throws. */
export function reportFailure(params: {
  title: string;
  body: string;
  url?: string;
  userInitiated?: boolean;
}): void {
  try {
    Sentry.captureMessage(params.title, {
      level: 'error',
      tags: { source: params.userInitiated ? 'user-report' : 'auto' },
      extra: {
        appVersion: appVersion(),
        url: params.url ?? '',
        detail: params.body,
      },
    });
  } catch {
    // never throw out of a report path
  }
}

/** Fire a user-initiated "Report an issue" (Settings → About) to Sentry. */
export function reportUserIssue(): void {
  try {
    Sentry.captureMessage('User reported an issue from Settings', {
      level: 'info',
      tags: { source: 'settings' },
      extra: { appVersion: appVersion() },
    });
  } catch {
    // never throw out of a report path
  }
}