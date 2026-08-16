import * as Sentry from '@sentry/react-native';
import Application from 'expo-application';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** Best-effort crash reporting — no-op unless a DSN is provided at build time. */
export function initSentry(): void {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    release: Application.nativeApplicationVersion ?? undefined,
    tracesSampleRate: 0.2,
  });
}