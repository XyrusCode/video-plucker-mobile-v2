// In-app browser tab (V1 parity): a "Where to?" landing with platform cards, an address bar
// with Go + platform quick links, and a floating Pluck button on known video pages. The chrome
// auto-hides when scrolling down a page and returns when scrolling up, like V1's BrowserChrome.

import React from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../theme';

/** Scroll listener bridging page scroll direction to the JS chrome (8px threshold, like V1). */
const SCROLL_LISTENER = `
;(function () {
  var lastY = 0;
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    if (Math.abs(y - lastY) >= 8) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'scroll', d: y > lastY ? 'down' : 'up' }));
      lastY = y;
    }
  }, { passive: true });
})();
true;
`;

/** Best-effort URL from user input (no scheme → https). Null when it's not URL-ish. */
function toUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(trimmed)) return `https://${trimmed}`;
  return null;
}

export default function BrowserScreen() {
  const setSharedUrl = useSharedUrl((s) => s.setSharedUrl);
  const [currentUrl, setCurrentUrl] = React.useState<string | null>(null);
  const [input, setInput] = React.useState('');
  const [landing, setLanding] = React.useState(true);
  const webRef = React.useRef<WebView>(null);
  const chromeAnim = React.useRef(new Animated.Value(1)).current;

  const onNavigationStateChange = (nav: WebViewNavigation) => {
    setCurrentUrl(nav.url);
    if (nav.url.startsWith('http://') || nav.url.startsWith('https://')) setInput(nav.url);
  };

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as { t?: string; d?: string };
      if (msg.t === 'scroll') {
        Animated.timing(chromeAnim, {
          toValue: msg.d === 'down' ? 0 : 1,
          duration: 180,
          useNativeDriver: true,
        }).start();
      }
    } catch {
      // Not ours — ignore.
    }
  };

  /** Navigate the WebView to [url] and dismiss the landing overlay. */
  const go = (url: string | null) => {
    if (!url) return;
    setLanding(false);
    setInput(url);
    webRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true`);
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

  const chromeStyle = {
    opacity: chromeAnim,
    transform: [
      {
        translateY: chromeAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-70, 0],
        }),
      },
    ],
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <Animated.View style={styles.chrome}>
        <View style={styles.addressRow} className="flex-row items-center gap-2">
          <TextInput
            style={styles.address}
            placeholder="Paste URL or search…"
            placeholderTextColor={colors.textDim}
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={() => go(toUrl(input))}
          />
          <Pressable
            onPress={() => go(toUrl(input))}
            disabled={!input.trim()}
            className="rounded-md bg-primary w-12 h-12 items-center justify-center"
          >
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips} className="flex gap-2 px-4"
        >
          {SUPPORTED_PLATFORMS.map((p) => (
            <Pressable
              key={p.cookieKey}
              onPress={() => go(p.homeUrl)}
              className="flex-row items-center gap-2 bg-panel2 border border-2 border-radius-pill px-4 py-2"
            >
              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <Text className="flex-1 text-foreground font-body">{p.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>

      <View style={styles.webBox} className="flex-1">
        <WebView
          ref={webRef}
          source={{ uri: 'about:blank' }}
          style={styles.web}
          onNavigationStateChange={onNavigationStateChange}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onMessage={onMessage}
          injectedJavaScript={SCROLL_LISTENER}
          allowsBackForwardNavigationGestures
        />
        {landing && (
          <View style={styles.landing} className="absolute top-0 left-0 right-0 bottom-0 bg-background p-6">
            <Text style={styles.landingTitle} className="text-foreground font-body text-2xl font-bold mt-6">
              Where to?
            </Text>
            <Text style={styles.landingDim} className="text-muted-foreground text-sm leading-[20px] mt-2">
              Pick a site, or type a URL above. The Pluck button appears on video pages.
            </Text>
            <View style={styles.platformList} className="gap-4 mt-8">
              {SUPPORTED_PLATFORMS.map((p) => (
                <Pressable
                  key={p.cookieKey}
                  onPress={() => go(p.homeUrl)}
                  className="flex-row items-center gap-4 bg-panel border border-2 border-radius-md py-3 px-4 h-12"
                >
                  <View className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <Text className="flex-1 text-foreground font-body">{p.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {isVideoPage && (
          <Pressable
            style={styles.fab} className="flex-row items-center gap-4 bg-primary px-6 py-4 rounded-2xl absolute right-6 bottom-6"
          >
            <Ionicons name="arrow-down-circle" size={22} color="#fff" />
            <Text style={styles.fabText} className="text-white font-bold text-lg">Pluck</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chrome: {
    backgroundColor: colors.panel,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  addressRow: { flexDirection: 'row', gap: spacing.sm },
  address: {
    flex: 1,
    backgroundColor: colors.panel2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: spacing.md,
    // height: 40 removed — let padding determine natural height
  },
  goBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { gap: spacing.sm, paddingRight: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.panel2,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    height: 30,
  },
  chipPressed: { opacity: 0.7 },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  webBox: { flex: 1 },
  web: { flex: 1, backgroundColor: colors.bg },
  landing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  landingTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginTop: spacing.xl,
  },
  landingDim: {
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  platformList: { gap: spacing.sm, marginTop: spacing.xl },
  platformCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  platformCardPressed: { opacity: 0.8 },
  platformDot: { width: 10, height: 10, borderRadius: 5 },
  platformName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
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