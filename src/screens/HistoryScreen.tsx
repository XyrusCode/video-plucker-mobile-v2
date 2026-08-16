// History tab — everything the app has exported to the gallery, with open + dismiss.
// Port of V1's HistoryTab (queryHistoryAsync + dismissed-Uri filtering).

import * as IntentLauncher from 'expo-intent-launcher';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, Row, Screen } from '../components/ui';
import { formatBytes, formatDate } from '../lib/format';
import { useHistory } from '../stores/history';
import { usePrefs } from '../stores/prefs';
import { colors, spacing } from '../theme';
import type { DownloadedFile } from 'yt-pluck';

export default function HistoryScreen() {
  const { items, loading, error, refresh } = useHistory();
  const dismissUri = usePrefs((s) => s.dismissUri);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const open = async (file: DownloadedFile) => {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: file.uri,
        type: file.mime,
        flags: 1,
      });
    } catch {
      // No viewer for this type — ignore.
    }
  };

  const dismiss = (file: DownloadedFile) => {
    dismissUri(file.uri);
  };

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <Row style={styles.header}>
          <Text style={styles.title}>History</Text>
          <Pressable onPress={() => void onRefresh()} hitSlop={8}>
            <Ionicons name="refresh" size={20} color={colors.textDim} />
          </Pressable>
        </Row>
        {loading && items.length === 0 && <EmptyState icon="…" text="Loading…" />}
        {!loading && items.length === 0 && (
          <EmptyState icon="↺" text={error ?? 'Nothing downloaded yet — your files will appear here'} />
        )}
        <View style={styles.list}>
          {items.map((file) => (
            <Card key={file.uri} style={styles.card}>
              <Row style={styles.row}>
                <Pressable style={styles.main} onPress={() => void open(file)}>
                  <Text style={styles.name} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={styles.dim}>
                    {formatBytes(file.sizeBytes)} • {formatDate(file.dateAddedSec)}
                  </Text>
                </Pressable>
                <Pressable onPress={() => dismiss(file)} hitSlop={8} style={styles.dismiss}>
                  <Ionicons name="close" size={18} color={colors.textDim} />
                </Pressable>
              </Row>
            </Card>
          ))}
        </View>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: spacing.lg },
  header: { justifyContent: 'space-between', marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  list: { gap: spacing.sm },
  card: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  row: { gap: spacing.sm },
  main: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600' },
  dim: { color: colors.textDim, fontSize: 12 },
  dismiss: { padding: spacing.xs },
});