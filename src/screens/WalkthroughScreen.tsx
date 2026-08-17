// First-run walkthrough — three quick cards, then a one-time permissions step, then the app.

import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { PermissionsAndroid, type Permission } from 'react-native';
import { GhostButton, PrimaryButton, Screen } from '../components/ui';
import { usePrefs } from '../stores/prefs';
import { colors, spacing } from '../theme';

const STEPS = [
  {
    title: 'Browse any video site',
    body: 'Open YouTube, X, TikTok or any of the 7 supported sites in the built-in browser. A Pluck button appears on video pages.',
  },
  {
    title: 'Pick a quality',
    body: 'From audio-only MP3/M4A up to 4K, and Image for TikTok photo posts. Downloads run in the background with progress in the notification.',
  },
  {
    title: 'Found in your gallery',
    body: 'Finished videos land in your Movies, Pictures and Music folders under "Video Plucker" — no hidden file access needed.',
  },
  {
    title: 'One-time permissions',
    body: 'Notifications keep your downloads running smoothly, the camera lets you sign in with QR codes, and "Allow app installs" lets Video Plucker install its own updates.',
    actions: true,
  },
];

const RUNTIME_PERMISSIONS: Permission[] = ['android.permission.POST_NOTIFICATIONS', 'android.permission.CAMERA'];

export default function WalkthroughScreen() {
  const finishWalkthrough = usePrefs((s) => s.finishWalkthrough);
  const [step, setStep] = React.useState(0);
  const [permNote, setPermNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const current = STEPS[step];

  const requestRuntime = async () => {
    setBusy(true);
    setPermNote(null);
    try {
      const results = await PermissionsAndroid.requestMultiple(RUNTIME_PERMISSIONS);
      const granted = Object.values(results).filter((r) => r === PermissionsAndroid.RESULTS.GRANTED).length;
      const total = Object.keys(results).length;
      setPermNote(
        granted === total
          ? 'All permissions granted.'
          : `${granted} of ${total} granted — you can change these anytime in system Settings.`
      );
    } catch {
      setPermNote('Could not request permissions right now.');
    } finally {
      setBusy(false);
    }
  };

  const allowInstalls = async () => {
    setPermNote(null);
    try {
      const androidId = await Application.getAndroidId();
      await IntentLauncher.startActivityAsync(
        'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
        { data: `package:${androidId}` }
      );
    } catch {
      setPermNote('Could not open the install-permission setting.');
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finishWalkthrough();
    }
  };

  return (
    <Screen style={styles.container}>
      <View style={styles.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>
        {current.actions && Platform.OS === 'android' && (
          <View style={styles.permBox}>
            <PrimaryButton
              label="Enable notifications & camera"
              onPress={() => void requestRuntime()}
              loading={busy}
            />
            <GhostButton label="Allow app installs" onPress={() => void allowInstalls()} />
            {permNote && <Text style={styles.permNote}>{permNote}</Text>}
          </View>
        )}
      </View>
      <View style={styles.actions}>
        {step < STEPS.length - 1 ? (
          <GhostButton label="Skip" onPress={finishWalkthrough} />
        ) : (
          <GhostButton label="Back" onPress={() => setStep((s) => Math.max(0, s - 1))} />
        )}
        <PrimaryButton
          label={step < STEPS.length - 1 ? 'Next' : 'Get Started'}
          onPress={next}
          style={styles.next}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.panel2 },
  dotActive: { backgroundColor: colors.accent, width: 22 },
  card: { flex: 1, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: spacing.md },
  body: { color: colors.textDim, fontSize: 15, lineHeight: 23 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  next: { flex: 1 },
  permBox: { gap: spacing.md, marginTop: spacing.lg },
  permNote: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
});