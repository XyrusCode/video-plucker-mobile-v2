// In-app browser tab. Port of V1's BrowserTab: fullscreen WebView with a floating Pluck
// button that appears on known video pages, plus app-link fallback URL handling.

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/ui';
import { platformForVideoUrl, webFallbackFromAppLink } from '../lib/platforms';
import { useSharedUrl } from '../stores/sharedUrl';
import { colors, spacing } from '../theme';

export default function BrowserScreen() {
  const setSharedUrl = useSharedUrl((s) => s.setSharedUrl);
  const [currentUrl, setCurrentUrl] = React.useState<string | null>(null);
  const webRef = React.useRef<WebView>(null);

  const onNavigationStateChange = (nav: WebViewNavigation) => {
    setCurrentUrl(nav.url);
  };

  // Bounce unknown-scheme deep links back into the WebView via their embedded web URL
  // (TikTok's snssdk1340://, Android's intent:// fallback), exactly like V1.
  const onShouldStartLoadWithRequest = (req: WebViewNavigation): boolean => {
    if (req.url.startsWith('http://') || req.url.startsWith('https://')) return true;
    const fallback = webFallbackFromAppLink(req.url);
    if (fallback) {
      webRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(fallback)}; true`);
      return false;
    }
    return false;
  };

  const isVideoPage = currentUrl != null && platformForVideoUrl(currentUrl) != null;
  const pluck = () => {
    if (currentUrl) setSharedUrl(currentUrl);
  };

  return (
    <Screen>
      <SafeAreaView edges={['top']} style={styles.container}>
        <WebView
          ref={webRef}
          source={{ uri: 'https://m.youtube.com' }}
          style={styles.web}
          onNavigationStateChange={onNavigationStateChange}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          allowsBackForwardNavigationGestures
        />
        {isVideoPage && (
          <Pressable style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]} onPress={pluck}>
            <Ionicons name="arrow-down-circle" size={22} color="#fff" />
            <Text style={styles.fabText}>Pluck</Text>
          </Pressable>
        )}
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  web: { flex: 1, backgroundColor: colors.bg },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    height: 48,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabPressed: { opacity: 0.85 },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});