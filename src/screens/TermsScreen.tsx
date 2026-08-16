// Terms gate — port of V1's TermsScreen. Static, dark-themed, scrollable.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, Screen } from '../components/ui';
import { usePrefs } from '../stores/prefs';
import { colors, spacing } from '../theme';

export default function TermsScreen() {
  const acceptTerms = usePrefs((s) => s.acceptTerms);
  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Terms of Use</Text>
        <Text style={styles.paragraph}>
          Video Plucker lets you download videos and audio from YouTube, X/Twitter, TikTok,
          Instagram, Facebook, Reddit and VK. By using this app you agree to the following:
        </Text>
        <Text style={styles.paragraph}>
          • Only download content you have the right to save — respect copyright, platform
          terms, and the creators you're downloading from. Downloads are for personal,
          non-commercial use.
        </Text>
        <Text style={styles.paragraph}>
          • Login sessions and cookies are stored on your device only and are used solely to
          fetch content you're allowed to access. They are never transmitted to us.
        </Text>
        <Text style={styles.paragraph}>
          • Some sites change how their content is delivered. Downloads may fail; we work to
          keep the app compatible but don't guarantee any specific video is downloadable.
        </Text>
        <Text style={styles.paragraph}>
          • This app is provided "as is" without warranty of any kind.
        </Text>
        <Text style={styles.paragraph}>
          You can stop using the app at any time. Uninstalling it removes its data from your
          device.
        </Text>
      </ScrollView>
      <PrimaryButton label="I Agree" onPress={acceptTerms} style={styles.accept} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  scroll: { paddingBottom: spacing.lg },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.lg },
  paragraph: {
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  accept: { marginTop: spacing.sm },
});