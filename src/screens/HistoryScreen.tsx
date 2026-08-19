// History tab — everything the app has exported to the gallery, with open + dismiss.
// Port of V1's HistoryTab (queryHistoryAsync + dismissed-Uri filtering).

import * as IntentLauncher from 'expo-intent-launcher';
import React from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/ui/card';
import { Text } from '../../components/ui/text';
import { formatBytes, formatDate } from '../lib/format';
import { useHistory } from '../stores/history';
import { usePrefs } from '../stores/prefs';
import { colors } from '../theme';
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
    <SafeAreaView edges={['top']} className="flex-1 bg-background px-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text size="2xl" bold>
          History
        </Text>
        <Pressable onPress={() => void onRefresh()} hitSlop={8}>
          <Ionicons name="refresh" size={20} color={refreshing ? colors.accent : colors.textDim} />
        </Pressable>
      </View>
      {loading && items.length === 0 && (
        <View className="items-center gap-3 py-12">
          <Text className="text-4xl text-muted-foreground">…</Text>
          <Text size="sm" className="text-center text-muted-foreground">Loading…</Text>
        </View>
      )}
      {!loading && items.length === 0 && (
        <View className="items-center gap-3 py-12">
          <Text className="text-4xl text-muted-foreground">↺</Text>
          <Text size="sm" className="text-center text-muted-foreground">
            {error ?? 'Nothing downloaded yet — your files will appear here'}
          </Text>
        </View>
      )}
      <View className="gap-2">
        {items.map((file) => (
          <Card key={file.uri} size="sm">
            <View className="flex-row items-center gap-2">
              <Pressable className="flex-1 gap-0.5" onPress={() => void open(file)}>
                <Text size="sm" bold numberOfLines={1}>
                  {file.name}
                </Text>
                <Text size="xs" className="text-muted-foreground">
                  {formatBytes(file.sizeBytes)} • {formatDate(file.dateAddedSec)}
                </Text>
              </Pressable>
              <Pressable onPress={() => dismiss(file)} hitSlop={8} className="p-1">
                <Ionicons name="close" size={18} color={colors.textDim} />
              </Pressable>
            </View>
          </Card>
        ))}
      </View>
    </SafeAreaView>
  );
}