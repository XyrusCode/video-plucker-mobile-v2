// Active downloads tab — progress, speed, ETA, pause/resume/cancel, and finished entries.
// Port of V1's QueueTab.

import React from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/ui/text';
import { Progress } from '../../components/ui/progress';
import { Button, ButtonText } from '../../components/ui/button';
import { reportFailure } from '../lib/report';
import { activeJobCount, pauseJob, resumeJob, useJobs } from '../stores/jobs';
import { usePrefs } from '../stores/prefs';
import { formatEta, formatSpeed } from '../lib/format';
import { colors, spacing } from '../theme';
import type { JobEntry } from '../stores/jobs';

const ORDER = ['RUNNING', 'QUEUED', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;

export default function QueueScreen() {
  const jobs = useJobs((s) => s.jobs);
  const entries = Object.values(jobs).sort(
    (a, b) => ORDER.indexOf(a.status as (typeof ORDER)[number]) - ORDER.indexOf(b.status as (typeof ORDER)[number])
  );
  const active = activeJobCount(jobs);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background px-4">
      <Text style={styles.title}>Queue</Text>
      {entries.length === 0 ? (
        <View className="items-center gap-3 py-12">
          <Text size="4xl" className="text-muted-foreground">…</Text>
          <Text size="sm" className="text-center text-muted-foreground">Nothing here yet — downloads you start will show up here</Text>
        </View>
      ) : (
        <View className="gap-2">
          {entries.map((job) => (
            <View key={job.jobId} className="p-4 rounded-xl bg-card border border-border gap-4">
              <View className="flex-row items-center justify-between">
                <Text size="sm" bold className="flex-1 text-foreground font-body">
                  {job.title}
                </Text>
                <Text size="sm" className="text-[11px] font-bold tracking-wider uppercase text-ok">
                  {job.status}
                </Text>
              </View>
              {job.status === 'RUNNING' || job.status === 'QUEUED' && (
                <View className="mt-2 flex items-center gap-2">
                  <Progress value={job.percent} className="h-2 bg-secondary rounded-full" />
                  <View className="flex-1 gap-2">
                    <Text size="xs" className="text-muted-foreground">
                      {job.percent.toFixed(0)}% • {formatSpeed(job.speedBytesPerSec)}
                    </Text>
                    <Text size="xs" className="text-muted-foreground">{formatEta(job.etaSeconds)}</Text>
                  </View>
                </View>
              )}
              {job.status === 'PAUSED' && (
                <Text size="xs" className="text-muted-foreground">Paused at {job.percent.toFixed(0)}% — resume to continue</Text>
              )}
              {job.status === 'FAILED' && job.error && (
                <Text size="xs" className="text-warn" numberOfLines={3}>
                  {job.error}
                </Text>
              )}
              {job.status === 'FAILED' && (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() =>
                    void reportFailure({
                      title: `Download failed: ${job.title.slice(0, 80)}`,
                      body: [
                        `**Title:** ${job.title}`,
                        `**URL:** ${job.url}`,
                        '**Error:**',
                        '```',
                        job.error ?? 'no error detail',
                        '```',
                      ].join('\n'),
                      url: job.url,
                      userInitiated: true,
                    })
                  }
                >
                  <ButtonText>Report</ButtonText>
                </Button>
              )}
              <View className="mt-3 flex gap-2">
                {job.status === 'RUNNING' || job.status === 'QUEUED' && (
                  <Button variant="outline" size="sm" onPress={() => void pauseJob(job.jobId)}>
                    <ButtonText>Pause</ButtonText>
                  </Button>
                )}
                {job.status === 'PAUSED' && (
                  <Button variant="outline" size="sm" onPress={() => void resumeJob(job.jobId)}>
                    <ButtonText>Resume</ButtonText>
                  </Button>
                )}
                {job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED' && (
                  <Button variant="outline" size="sm" onPress={() => void useJobs.getState().remove(job.jobId)}>
                    <ButtonText>Clear</ButtonText>
                  </Button>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = {
  title: { color: colors.text, fontSize: 22, fontWeight: '800' as const, marginBottom: spacing.md },
};