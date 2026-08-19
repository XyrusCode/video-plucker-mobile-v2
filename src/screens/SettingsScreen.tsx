// Settings tab — Cookie Manager entry, update downloader, check for updates (V1 parity).

import * as Application from 'expo-application';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, GhostButton, PrimaryButton, ProgressBar, Row, Screen, SectionTitle } from '../components/ui';
import { reportUserIssue } from '../lib/report';
import { usePrefs } from '../stores/prefs';
import { checkForUpdates, downloadUpdate, installUpdate, type UpdateInfo } from '../services/update';
import { getFlag } from '../services/remoteConfig';
import YtPluckModule from 'yt-pluck';
import { colors, spacing } from '../theme';

type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'uptodate'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'error';

export default function SettingsScreen({
  onOpenCookies,
}: {
  onOpenCookies: () => void;
}) {
  const [phase, setPhase] = React.useState<UpdatePhase>('idle');
  const [info, setInfo] = React.useState<UpdateInfo | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [updatingEngine, setUpdatingEngine] = React.useState(false);
  const [engineNote, setEngineNote] = React.useState<string | null>(null);
  const engineBooted = usePrefs((s) => s.engineBooted);
  const browserEnabled = usePrefs((s) => s.browserEnabled);
  const setBrowserEnabled = usePrefs((s) => s.setBrowserEnabled);
  const version = Application.nativeApplicationVersion ?? 'unknown';
  // Store builds (F-Droid) manage updates themselves; GitHub-release self-updates are for the
  // direct/GitHub build only.
  const updatesEnabled =
    getFlag('updates_enabled') && process.env.EXPO_PUBLIC_STORE !== 'fdroid';

  const check = async () => {
    setPhase('checking');
    setError(null);
    try {
      const result = await checkForUpdates();
      if (!result) {
        setPhase('uptodate');
      } else {
        setInfo(result);
        setPhase('available');
      }
    } catch {
      setPhase('error');
      setError('Could not reach the update server.');
    }
  };

  const downloadAndInstall = async () => {
    if (!info) return;
    setPhase('downloading');
    try {
      const file = await downloadUpdate(info.downloadUrl, (p) => setProgress(p.percent));
      setPhase('installing');
      await installUpdate(file);
      setPhase('available');
    } catch {
      setPhase('error');
      setError('The update download failed. Check your connection and try again.');
    }
  };

  const updateEngine = async () => {
    setUpdatingEngine(true);
    setEngineNote(null);
    try {
      const ok = await YtPluckModule.updateEngineAsync();
      setEngineNote(ok ? 'Downloader is up to date.' : 'Update failed — try again later.');
    } finally {
      setUpdatingEngine(false);
    }
  };

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Text style={styles.title}>Settings</Text>

        <SectionTitle>Downloads</SectionTitle>
        <Card style={styles.card}>
          <Pressable style={styles.rowBtn} onPress={onOpenCookies}>
            <Row style={styles.row}>
              <Ionicons name="key" size={18} color={colors.textDim} />
              <Text style={styles.rowLabel}>Cookie Manager</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
            </Row>
            <Text style={styles.dim}>Log in or import cookies.txt for sites that require it</Text>
          </Pressable>
          <Pressable style={styles.rowBtn} onPress={updateEngine} disabled={updatingEngine}>
            <Row style={styles.row}>
              <Ionicons name="refresh" size={18} color={colors.textDim} />
              <Text style={styles.rowLabel}>
                {updatingEngine ? 'Updating downloader…' : 'Update downloader'}
              </Text>
            </Row>
            {engineNote && <Text style={styles.dim}>{engineNote}</Text>}
          </Pressable>
        </Card>

        <SectionTitle>Browser</SectionTitle>
        <Card style={styles.card}>
          <Row style={styles.row}>
            <Ionicons name="globe" size={18} color={colors.textDim} />
            <Text style={styles.rowLabel}>Built-in browser</Text>
            <Switch
              value={browserEnabled}
              onValueChange={setBrowserEnabled}
              trackColor={{ false: colors.panel2, true: colors.accentDim }}
              thumbColor={browserEnabled ? colors.accent : colors.textDim}
            />
          </Row>
          <Text style={styles.dim}>Show the browser tab for browsing and plucking videos</Text>
        </Card>

        <SectionTitle>Updates</SectionTitle>
        {updatesEnabled ? (
          <Card style={styles.card}>
            <Pressable style={styles.rowBtn} onPress={() => void check()} disabled={phase === 'checking'}>
              <Row style={styles.row}>
                <Ionicons name="cloud-download" size={18} color={colors.textDim} />
                <Text style={styles.rowLabel}>
                  {phase === 'checking' ? 'Checking…' : 'Check for Updates'}
                </Text>
              </Row>
            </Pressable>

            {phase === 'uptodate' && <Text style={styles.dim}>You're on the latest version (v{version}).</Text>}
            {phase === 'available' && info && (
              <View style={styles.updateBox}>
                <Text style={styles.updateTitle}>v{info.latestVersion} available</Text>
                {info.notes ? (
                  <Text style={styles.dim} numberOfLines={4}>
                    {info.notes}
                  </Text>
                ) : null}
                <PrimaryButton label="Download & Install" onPress={() => void downloadAndInstall()} />
              </View>
            )}
            {phase === 'downloading' && (
              <View style={styles.updateBox}>
                <Text style={styles.dim}>Downloading update…</Text>
                <ProgressBar percent={progress} />
              </View>
            )}
            {phase === 'installing' && <Text style={styles.dim}>Opening installer…</Text>}
            {phase === 'error' && <Text style={styles.warnText}>{error}</Text>}
          </Card>
        ) : (
          <Card style={styles.card}>
            <Text style={styles.dim}>Updates are managed by your app store.</Text>
          </Card>
        )}

        <SectionTitle>About</SectionTitle>
        <Card style={styles.card}>
          <Text style={styles.rowLabel}>Video Plucker</Text>
          <Text style={styles.dim}>
            Version {version} {__DEV__ ? '(dev)' : ''}
          </Text>
          <Text style={styles.dim}>
            Engine: {engineBooted ? 'ready' : 'not booted'} • yt-dlp + ffmpeg
          </Text>
          <Text style={styles.dim}>Downloads: YouTube, X/Twitter, TikTok, Instagram, Facebook, Reddit, VK</Text>
          <Pressable style={styles.rowBtn} onPress={reportUserIssue}>
            <Row style={styles.row}>
              <Ionicons name="bug" size={18} color={colors.textDim} />
              <Text style={styles.rowLabel}>Report an issue</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
            </Row>
          </Pressable>
        </Card>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: spacing.lg },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.lg },
  card: { gap: spacing.sm, marginBottom: spacing.xl },
  rowBtn: { gap: 4 },
  row: { gap: spacing.sm, alignItems: 'center' },
  rowLabel: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  dim: { color: colors.textDim, fontSize: 12, lineHeight: 17 },
  warnText: { color: colors.warn, fontSize: 13 },
  updateBox: { gap: spacing.sm, paddingTop: spacing.sm },
  updateTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
});