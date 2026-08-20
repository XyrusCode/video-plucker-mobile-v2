// Error reporting — all failures and crashes go to Sentry (org `xyrus-code`, project
// `video-plucker`). There are no GitHub/GitLab issue links anymore: analysis failures,
// download failures and manual "Report an issue" presses are captured as Sentry events,
// which keeps issue tracking + bug tracking in one place.

import * as Sentry from '@sentry/react-native';
import * as Application from 'expo-application';
import { Alert } from 'react-native';

const appVersion = (): string => Application.nativeApplicationVersion ?? 'unknown';

/**
 * Fire an error report to Sentry. Best-effort; never throws. Returns `true` when the event
 * was accepted by the SDK (or flushed, for user-initiated reports).
 *
 * When `userInitiated` is set, the user gets visible feedback (an Alert) so a manual
 * "Report" press is never a silent no-op — previously it looked like the button "didn't
 * work" even when the event had actually been sent.
 */
export async function reportFailure(params: {
  title: string;
  body: string;
  url?: string;
  userInitiated?: boolean;
}): Promise<boolean> {
  try {
    if (!Sentry.getClient()) {
      if (params.userInitiated) {
        Alert.alert(
          'Reporting unavailable',
          'Crash reporting is not configured in this build. The error is still shown on screen.',
        );
      }
      return false;
    }
    Sentry.captureMessage(params.title, {
      level: 'error',
      tags: { source: params.userInitiated ? 'user-report' : 'auto' },
      extra: {
        appVersion: appVersion(),
        url: params.url ?? '',
        detail: params.body,
      },
    });
    if (params.userInitiated) {
      // Flush synchronously so the user gets honest feedback instead of assuming failure.
      const flushed = await Sentry.flush();
      Alert.alert(
        flushed ? 'Report sent' : 'Report queued',
        flushed
          ? 'Thanks — the error details were sent to the developer.'
          : 'The report was queued and will be sent as soon as the network allows.',
      );
      return flushed;
    }
    return true;
  } catch {
    return false;
  }
}

/** Fire a user-initiated "Report an issue" (Settings → About) to Sentry. */
export function reportUserIssue(): void {
  try {
    if (!Sentry.getClient()) {
      Alert.alert('Reporting unavailable', 'Crash reporting is not configured in this build.');
      return;
    }
    Sentry.captureMessage('User reported an issue from Settings', {
      level: 'info',
      tags: { source: 'settings' },
      extra: { appVersion: appVersion() },
    });
    void Sentry.flush().then((flushed) => {
      Alert.alert(
        flushed ? 'Report sent' : 'Report queued',
        flushed
          ? 'Thanks — the report was sent to the developer.'
          : 'The report was queued and will be sent as soon as the network allows.',
      );
    });
  } catch {
    // never throw out of a report path
  }
}
