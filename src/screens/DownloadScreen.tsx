// Paste/analyze/download tab. Port of V1's DownloadTab: URL input, probe (metadata), quality
// selection (remembered per platform), then start the download in the background.

import React from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProbeResult, QualityId } from 'yt-pluck';
import { Card, EmptyState, GhostButton, PrimaryButton, Row, Screen } from '../components/ui';
import { formatDuration } from '../lib/format';
import { platformForExtractorKey, platformForVideoUrl } from '../lib/platforms';
import { reportFailure } from '../lib/report';
import { QUALITIES, VIDEO_QUALITIES, qualityHeightLabel } from '../lib/quality';
import { useJobs } from '../stores/jobs';
import { usePrefs } from '../stores/prefs';
import { useSharedUrl } from '../stores/sharedUrl';
import { probeUrl, startDownload } from '../services/download';
import { colors, radii, spacing } from '../theme';

type Phase = 'idle' | 'analyzing' | 'ready' | 'error';

export default function DownloadScreen({ onGoToQueue }: { onGoToQueue: () => void }) {
  const [input, setInput] = React.useState('');
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<string | null>(null);
  const [probe, setProbe] = React.useState<ProbeResult | null>(null);
  const [quality, setQuality] = React.useState<QualityId>('best');
  const [lastAnalyzedUrl, setLastAnalyzedUrl] = React.useState('');

  const sharedUrl = useSharedUrl((s) => s.url);
  const sharedNonce = useSharedUrl((s) => s.nonce);
  const rememberQuality = usePrefs((s) => s.rememberQuality);
  const lastQuality = usePrefs((s) => s.lastQuality);
  const runningCount = Object.values(useJobs((s) => s.jobs)).filter(
    (j) => j.status === 'RUNNING'
  ).length;

  // A URL arriving from the browser FAB, the share sheet, or a deep link jumps straight in.
  React.useEffect(() => {
    if (!sharedUrl) return;
    setInput(sharedUrl);
    void analyze(sharedUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedNonce]);

  const analyze = async (url?: string) => {
    const target = (url ?? input).trim();
    if (!target) return;
    Keyboard.dismiss();
    setPhase('analyzing');
    setError(null);
    setDetail(null);
    setLastAnalyzedUrl(target);
    try {
      const result = await probeUrl(target);
      const platform = platformForExtractorKey(result.source ?? '') ?? platformForVideoUrl(target);
      const remembered = platform ? lastQuality[platform.cookieKey] : undefined;
      setProbe(result);
      if (remembered) setQuality(remembered);
      setPhase('ready');
    } catch (e) {
      setDetail(describeError(e));
      setError(cleanEngineError(e, target));
      setProbe(null);
      setPhase('error');
      // Every analysis failure lands in Sentry automatically.
      reportFailure({
        title: `Analysis failed: ${target.slice(0, 80)}`,
        body: buildReportBody(target, cleanEngineError(e, target), describeError(e)),
        url: target,
      });
    }
  };

  const download = async () => {
    if (!probe) return;
    setStarting(true);
    try {
      const platform =
        platformForExtractorKey(probe.source ?? '') ?? platformForVideoUrl(lastAnalyzedUrl);
      if (platform) rememberQuality(platform.cookieKey, quality);
      await startDownload(lastAnalyzedUrl, quality);
      onGoToQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start download');
    } finally {
      setStarting(false);
    }
  };

  const qualitySet = [
    ...VIDEO_QUALITIES,
    QUALITIES.find((q) => q.id === 'image')!,
    QUALITIES.find((q) => q.id === 'mp3')!,
    QUALITIES.find((q) => q.id === 'm4a')!,
  ];

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Text style={styles.title}>Download</Text>
        <TextInput
          style={styles.input}
          placeholder="Paste a video URL"
          placeholderTextColor={colors.textDim}
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onSubmitEditing={() => void analyze()}
          returnKeyType="search"
        />
        <Row style={styles.actions}>
          <GhostButton
            label="Clear"
            onPress={() => {
              setInput('');
              setPhase('idle');
              setError(null);
              setDetail(null);
            }}
            style={styles.clearBtn}
            disabled={!input}
          />
          <PrimaryButton
            label="Analyze"
            onPress={() => void analyze()}
            loading={phase === 'analyzing'}
            style={styles.analyzeBtn}
            disabled={!input.trim()}
          />
        </Row>

        {phase === 'analyzing' && (
          <Card style={styles.card}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.dim}>Analyzing…</Text>
          </Card>
        )}

        {phase === 'error' && (
          <Card style={styles.card}>
            <Text style={styles.errorText}>{error}</Text>
            <GhostButton
              label="Report"
              onPress={() =>
                reportFailure({
                  title: `Analysis failed: ${lastAnalyzedUrl.slice(0, 80)}`,
                  body: buildReportBody(
                    lastAnalyzedUrl,
                    error ?? '',
                    detail ?? undefined
                  ),
                  url: lastAnalyzedUrl,
                  userInitiated: true,
                })
              }
              style={styles.reportBtn}
            />
          </Card>
        )}

        {phase === 'ready' && probe && (
          <View style={styles.result}>
            <Card style={styles.card}>
              <View style={styles.metaRow}>
                {probe.thumbnailUrl ? (
                  <Image source={{ uri: probe.thumbnailUrl }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]} />
                )}
                <View style={styles.metaText}>
                  <Text style={styles.videoTitle} numberOfLines={2}>
                    {probe.title}
                  </Text>
                  <Text style={styles.dim}>
                    {probe.uploader ? `${probe.uploader} • ` : ''}
                    {formatDuration(probe.durationSeconds)}
                  </Text>
                </View>
              </View>
            </Card>

            <Text style={styles.sectionLabel}>Quality</Text>
            <View style={styles.chips}>
              {qualitySet.map((q) => (
                <Pressable
                  key={q.id}
                  onPress={() => setQuality(q.id)}
                  style={[styles.chip, q.id === quality && styles.chipActive]}
                >
                  <Text style={[styles.chipText, q.id === quality && styles.chipTextActive]}>
                    {q.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.dim}>{qualityHeightLabel(quality)}</Text>
            <PrimaryButton
              label={runningCount > 0 ? 'Download (1 already running)' : 'Download'}
              onPress={() => void download()}
              loading={starting}
              style={styles.downloadBtn}
            />
          </View>
        )}

        {phase === 'idle' && (
          <EmptyState icon="⌄" text="Paste a link, or share one into Video Plucker" />
        )}
      </SafeAreaView>
    </Screen>
  );
}

function cleanEngineError(e: unknown, url: string): string {
  const raw =
    e instanceof Error
      ? (e.message ?? String(e))
      : typeof e === 'string'
        ? e
        : e
          ? safeStringify(e)
          : '';
  const msg = raw.trim() || 'Analysis failed';
  const lower = msg.toLowerCase();
  if (lower.includes('unsupported url') && url.includes('tiktok.com')) {
    return "That link is a TikTok photo/slideshow post or a short link that couldn't be resolved. Copy the share link from the app, or use Image quality on a /photo/ URL.";
  }
  return msg;
}

/** Full detail (message + stack) for the report body; falls back to a stringified value. */
function describeError(e: unknown): string {
  if (e instanceof Error) {
    return [e.message, e.stack].filter(Boolean).join('\n');
  }
  return typeof e === 'string' ? e : safeStringify(e);
}

function safeStringify(e: unknown): string {
  try {
    return JSON.stringify(e) ?? String(e);
  } catch {
    return String(e);
  }
}

/** Human-readable report body (markdown) for a failed analysis. */
function buildReportBody(url: string, error: string, detail?: string): string {
  return [
    `**URL:** ${url}`,
    '**Error:**',
    '```',
    error,
    '```',
    ...(detail ? ['**Detail:**', '```', detail, '```'] : []),
  ].join('\n');
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: spacing.lg },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.md },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  actions: { gap: spacing.md, marginTop: spacing.md },
  clearBtn: { flex: 1 },
  analyzeBtn: { flex: 2 },
  card: { marginTop: spacing.lg, alignItems: 'center', gap: spacing.sm },
  errorText: { color: colors.warn, fontSize: 14, lineHeight: 20 },
  reportBtn: { marginTop: spacing.xs },
  result: { marginTop: spacing.lg },
  metaRow: { flexDirection: 'row', gap: spacing.md },
  thumb: { width: 96, height: 54, borderRadius: radii.sm, backgroundColor: colors.panel2 },
  thumbPlaceholder: {},
  metaText: { flex: 1, justifyContent: 'center', gap: 4 },
  videoTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  dim: { color: colors.textDim, fontSize: 13 },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    backgroundColor: colors.panel2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  downloadBtn: { marginTop: spacing.lg },
});