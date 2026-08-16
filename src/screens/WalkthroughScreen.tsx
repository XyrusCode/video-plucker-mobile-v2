// First-run walkthrough — three quick cards, then into the app.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
];

export default function WalkthroughScreen() {
  const finishWalkthrough = usePrefs((s) => s.finishWalkthrough);
  const [step, setStep] = React.useState(0);
  const current = STEPS[step];

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
      </View>
      <View style={styles.actions}>
        {step < STEPS.length - 1 ? (
          <GhostButton label="Skip" onPress={finishWalkthrough} />
        ) : (
          <GhostButton label="Back" onPress={() => setStep((s) => Math.max(0, s - 1))} />
        )}
        <PrimaryButton
          label={step < STEPS.length - 1 ? 'Next' : 'Get Started'}
          onPress={() => (step < STEPS.length - 1 ? setStep((s) => s + 1) : finishWalkthrough())}
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
});