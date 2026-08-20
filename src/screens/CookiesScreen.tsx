// Cookie Manager — port of V1's CookiesScreen. Pick a platform: log in (WebView) to export its
// session cookies, import a cookies.txt file (takes precedence), or clear everything.

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Card, EmptyState, GhostButton, PrimaryButton, Row } from '../components/ui';
import { exportCookiesToFile, saveImportedCookies } from '../lib/cookies';
import { formatDate } from '../lib/format';
import { platformForCookieKey, SUPPORTED_PLATFORMS, type SitePlatform } from '../lib/platforms';
import { usePrefs } from '../stores/prefs';
import { colors, spacing } from '../theme';

export default function CookiesScreen() {
  const [selected, setSelected] = React.useState<SitePlatform | null>(null);
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background px-4">
      <Text style={styles.title}>Cookie Manager</Text>
      <Text style={styles.dim}>
        Some sites (TikTok, X, Instagram…) work better — or at all — when the downloader uses
        your login. Cookies stay on this device and are only used for downloads.
      </Text>
      <View style={styles.list} className="gap-2 mb-4">
        {SUPPORTED_PLATFORMS.map((p) => (
          <Card key={p.cookieKey} className="p-3 gap-3" onPress={() => setSelected(p)}>
            <Row style={styles.row} className="flex-row items-center gap-2">
              <Text style={styles.name} className="text-foreground font-body">
                {p.name}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
            </Row>
          </Card>
        ))}
      </View>
      {selected && (
        <PlatformModal platform={selected} onClose={() => setSelected(null)} />
      )}
    </SafeAreaView>
  );
}

function PlatformModal({ platform, onClose }: { platform: SitePlatform; onClose: () => void }) {
  const imported = usePrefs((s) => s.importedCookies[platform.cookieKey] ?? null);
  const savedSession = usePrefs((s) => s.savedCookieSessions[platform.cookieKey] ?? null);
  const setImportedCookies = usePrefs((s) => s.setImportedCookies);
  const clearImportedCookies = usePrefs((s) => s.clearImportedCookies);
  const setSavedCookieSession = usePrefs((s) => s.setSavedCookieSession);
  const clearSavedCookieSession = usePrefs((s) => s.clearSavedCookieSession);
  const [showLogin, setShowLogin] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);

  const importFile = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
      if (
        !text.includes('# Netscape') &&
        !text.includes('.youtube.com')
      ) {
        setNote('That file does not look like a Netscape-format cookies.txt file.');
        return;
      }
      const path = await saveImportedCookies(platform.cookieKey, text);
      setImportedCookies(platform.cookieKey, path);
      setNote(
        'Imported. This file will be used for all ' + platform.name + ' downloads.'
      );
    } catch {
      setNote('Could not read that file.');
    } finally {
      setBusy(false);
    }
  };

  /** "Done — export my cookies": actually save the login session to a durable file now. */
  const saveSession = async () => {
    setBusy(true);
    setNote(null);
    try {
      const path = await exportCookiesToFile(platform, true);
      if (!path) {
        setNote(
          'No session found. Make sure you are signed in, then try "Save cookies" again.'
        );
        return;
      }
      clearImportedCookies(platform.cookieKey);
      setSavedCookieSession(platform.cookieKey, path);
      setShowLogin(false);
      setNote('Cookies saved. Downloads will use your ' + platform.name + ' session.');
    } catch {
      setNote('Could not save the session. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    clearImportedCookies(platform.cookieKey);
    clearSavedCookieSession(platform.cookieKey);
    setNote('Cookies cleared.');
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background px-4">
        <Row style={styles.modalHeader} className="flex-row items-center gap-4 mb-4">
          <Pressable onPress={onClose} hitSlop={10} className="p-2">
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.title} className="text-foreground font-body">
            {platform.name} cookies
          </Text>
        </Row>

        {showLogin ? (
          <View style={styles.loginBox} className="flex-1">
            <WebView
              source={{ uri: platform.loginUrl }}
              style={styles.web} className="flex-1 bg-[var(--bg)]"
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
            />
            <PrimaryButton
              label="Done — save my cookies"
              onPress={() => void saveSession()}
              loading={busy}
              className="mt-4"
            />
          </View>
        ) : (
          <>
            <Card className="p-3 gap-3">
              <Text style={styles.dim} className="text-dim text-sm">
                {imported
                  ? `Imported cookies.txt (${formatDate(
                      Math.floor(imported.importedAt / 1000)
                    )})${note ? ` — ${note}` : ''}`
                  : savedSession
                      ? `Saved session (${formatDate(
                          Math.floor(savedSession.savedAt / 1000)
                        )})${note ? ` — ${note}` : ''}`
                      : note
                        ? note
                        : 'No cookies yet.'}
              </Text>
            </Card>
            <Row style={styles.actions} className="flex-row gap-3 mt-3">
              <GhostButton
                label="Log in"
                onPress={() => setShowLogin(true)}
                disabled={busy}
                className="flex-1"
              />
              <GhostButton
                label="Import cookies.txt"
                onPress={() => void importFile()}
                disabled={busy}
                className="flex-1"
              />
            </Row>
            {(imported || savedSession) && (
              <GhostButton
                label="Clear cookies"
                onPress={clear}
                className="mt-2"
              />
            )}
            {!imported && !savedSession && (
              <Text style={styles.dim} className="text-dim text-sm mt-2">
                Tip: after logging in, tap "Done — save my cookies" and downloads will
                automatically use your session.
              </Text>
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: spacing.lg },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.md },
  dim: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  list: { gap: spacing.sm, marginTop: spacing.lg },
  modalHeader: { gap: spacing.md, marginBottom: spacing.md },
  loginBox: { flex: 1 },
  web: { flex: 1, backgroundColor: colors.bg },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1 },
  clearBtn: { marginTop: spacing.sm },
});