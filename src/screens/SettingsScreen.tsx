// Settings tab — Cookie Manager entry, update downloader, check for updates (V1 parity).

import * as Application from 'expo-application';
import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, Row } from '../components/ui';
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
    <SafeAreaView edges={['top']} className="flex-1 bg-background px-6 py-6">
      <Text style={styles.title}>Settings</Text>

      <Text className="mb-4 text-xl font-bold">
        Downloads
      </Text>

      <Card className="p-4 gap-4">
        <Pressable onPress={onOpenCookies} className="flex-row items-center gap-2">
          <Ionicons name="key" size={18} color={colors.textDim} />
          <Text className="flex-1 text-foreground font-body">Cookie Manager</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
        </Pressable>
        <Text className="text-dim text-sm">
          Log in or import cookies.txt for sites that require it
        </Text>
      </Card>

      <Pressable onPress={updateEngine} disabled={updatingEngine} className="mt-3 flex-row items-center gap-2">
        <Ionicons name="refresh" size={18} color={colors.textDim} />
        <Text className="flex-1 text-foreground font-body">
          {updatingEngine ? 'Updating downloader…' : 'Update downloader'}
        </Text>
      </Pressable>
      {engineNote && <Text className="mt-1 text-dim text-sm">{engineNote}</Text>}

      <Text className="mb-4 text-xl font-bold">
        Browser
      </Text>

      <Card className="p-4 gap-4">
        <Row className="flex-row items-center gap-2">
          <Ionicons name="globe" size={18} color={colors.textDim} />
          <Text className="flex-1 text-foreground font-body">Built-in browser</Text>
          <Switch
            value={browserEnabled}
            onValueChange={setBrowserEnabled}
            trackColor={{ false: 'var(--secondary)', true: 'var(--accentDim)' }}
            thumbColor={browserEnabled ? 'var(--accent)' : 'var(--textDim)'}
          />
        </Row>
        <Text className="mt-2 text-dim text-sm">
          Show the browser tab for browsing and plucking videos
        </Text>
      </Card>

      <Text className="mb-4 text-xl font-bold">
        Updates
      </Text>

      {updatesEnabled ? (
        <Card className="p-4 gap-4">
          <Pressable onPress={() => void check()} disabled={phase === 'checking'} className="flex-row items-center gap-2">
            <Ionicons name="cloud-download" size={18} color={colors.textDim} />
            <Text className="flex-1 text-foreground font-body">
              {phase === 'checking' ? 'Checking…' : 'Check for Updates'}
            </Text>
          </Pressable>

          {phase === 'uptodate' && <Text className="mt-2 text-dim text-sm">You're on the latest version (v{version}).</Text>}
          {phase === 'available' && info && (
            <View className="mt-2 gap-2">
              <Text className="text-foreground font-body">v{info.latestVersion} available</Text>
              {info.notes && (
                <Text className="mt-1 text-dim text-sm" numberOfLines={4}>{info.notes}</Text>
              )}
              <Button label="Download & Install" onPress={() => void downloadAndInstall()} />
            </View>
          )}
          {phase === 'downloading' && (
            <View className="mt-2 gap-2">
              <Text className="text-dim text-sm">Downloading update…</Text>
              <Progress value={progress} className="h-2 bg-secondary rounded-full" />
            </View>
          )}
          {phase === 'installing' && <Text className="mt-2 text-dim">Opening installer…</Text>}
          {phase === 'error' && <Text className="mt-2 text-warn">{error}</Text>}
        </Card>
      ) : (
        <Card className="p-4 gap-4">
          <Text className="text-dim">Updates are managed by your app store.</Text>
        </Card>
      )}

      <Text className="mb-4 text-xl font-bold">
        About
      </Text>

      <Card className="p-4 gap-4">
        <Text className="text-foreground font-body">Video Plucker</Text>
        <Text className="text-dim">
          Version {version} {__DEV__ ? '(dev)' : ''}
        </Text>
        <Text className="text-dim">Engine: {engineBooted ? 'ready' : 'not booted'} • yt-dlp + ffmpeg</Text>
        <Text className="text-dim">Downloads: YouTube, X/Twitter, TikTok, Instagram, Facebook, Reddit, VK</Text>
        <Pressable onPress={reportUserIssue} className="mt-3 flex-row items-center gap-2">
          <Ionicons name="bug" size={18} color={colors.textDim} />
          <Text className="flex-1 text-foreground font-body">Report an issue</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
        </Pressable>
      </Card>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: spacing.lg },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.lg },
});