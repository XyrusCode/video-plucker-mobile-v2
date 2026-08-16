// Active downloads tab — progress, speed, ETA, pause/resume/cancel, and finished entries.
// Port of V1's QueueTab.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, GhostButton, ProgressBar, Row, Screen } from '../components/ui';
import { formatEta, formatSpeed } from '../lib/format';
import { activeJobCount, cancelJob, pauseJob, resumeJob, useJobs } from '../stores/jobs';
import { colors, radii, spacing } from '../theme';
import type { JobEntry } from '../stores/jobs';

const ORDER = ['RUNNING', 'QUEUED', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;

export default function QueueScreen() {
  const jobs = useJobs((s) => s.jobs);
  const entries = Object.values(jobs).sort(
    (a, b) => ORDER.indexOf(a.status as (typeof ORDER)[number]) - ORDER.indexOf(b.status as (typeof ORDER)[number])
  );
  const active = activeJobCount(jobs);

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Text style={styles.title}>Queue</Text>
        {entries.length === 0 ? (
          <EmptyState icon="≡" text="Nothing here yet — downloads you start will show up here" />
        ) : (
          <View style={styles.list}>
            {entries.map((job) => (
              <JobCard key={job.jobId} job={job} />
            ))}
          </View>
        )}
      </SafeAreaView>
    </Screen>
  );
}

function JobCard({ job }: { job: JobEntry }) {
  const isLive = job.status === 'RUNNING' || job.status === 'QUEUED';
  const isPaused = job.status === 'PAUSED';
  const isFinished = job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED';
  const statusColor =
    job.status === 'FAILED'
      ? colors.warn
      : job.status === 'COMPLETED'
        ? colors.ok
        : job.status === 'CANCELLED'
          ? colors.textDim
          : colors.accent;

  return (
    <Card style={styles.card}>
      <Row style={styles.header}>
        <Text style={styles.jobTitle} numberOfLines={1}>
          {job.title}
        </Text>
        <Text style={[styles.status, { color: statusColor }]}>{job.status}</Text>
      </Row>
      {isLive && (
        <>
          <ProgressBar percent={job.percent} />
          <Row style={styles.meta}>
            <Text style={styles.dim}>
              {job.percent.toFixed(0)}% • {formatSpeed(job.speedBytesPerSec)}
            </Text>
            <Text style={styles.dim}>{formatEta(job.etaSeconds)}</Text>
          </Row>
        </>
      )}
      {isPaused && (
        <Text style={styles.dim}>Paused at {job.percent.toFixed(0)}% — resume to continue</Text>
      )}
      {job.status === 'FAILED' && job.error && (
        <Text style={styles.errorText} numberOfLines={3}>
          {job.error}
        </Text>
      )}
      <Row style={styles.actions}>
        {isLive && (
          <>
            <GhostButton label="Pause" onPress={() => pauseJob(job.jobId)} style={styles.actionBtn} />
            <GhostButton label="Cancel" onPress={() => cancelJob(job.jobId)} style={styles.actionBtn} />
          </>
        )}
        {isPaused && (
          <GhostButton label="Resume" onPress={() => resumeJob(job.jobId)} style={styles.actionBtn} />
        )}
        {isFinished && (
          <GhostButton label="Clear" onPress={() => useJobs.getState().remove(job.jobId)} style={styles.actionBtn} />
        )}
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: spacing.lg },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.md },
  list: { gap: spacing.md },
  card: { gap: spacing.sm },
  header: { justifyContent: 'space-between', gap: spacing.sm },
  jobTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  status: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  meta: { justifyContent: 'space-between' },
  dim: { color: colors.textDim, fontSize: 12 },
  errorText: { color: colors.warn, fontSize: 12, lineHeight: 17 },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: { flex: 1 },
});