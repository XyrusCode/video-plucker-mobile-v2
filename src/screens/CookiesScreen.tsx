// Cookie Manager — port of V1's CookiesScreen. Pick a platform: log in (WebView) to export its
// session cookies, import a cookies.txt file (takes precedence), or clear everything.

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Card, GhostButton, PrimaryButton, Row, Screen } from '../components/ui';
import { exportCookiesToFile, saveImportedCookies } from '../lib/cookies';
import { formatDate } from '../lib/format';
import { platformForCookieKey, SUPPORTED_PLATFORMS, type SitePlatform } from '../lib/platforms';
import { usePrefs } from '../stores/prefs';
import { colors, spacing } from '../theme';

export default function CookiesScreen() {
  const [selected, setSelected] = React.useState<SitePlatform | null>(null);
  return (
    <Screen>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <Text style={styles.title}>Cookie Manager</Text>
        <Text style={styles.dim}>
          Some sites (TikTok, X, Instagram…) work better — or at all — when the downloader uses
          your login. Cookies stay on this device and are only used for downloads.
        </Text>
        <View style={styles.list}>
          {SUPPORTED_PLATFORMS.map((p) => (
            <Card key={p.cookieKey} style={styles.card}>
              <Pressable style={styles.rowBtn} onPress={() => setSelected(p)}>
                <Row style={styles.row}>
                  <Text style={styles.name}>{p.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
                </Row>
              </Pressable>
            </Card>
          ))}
        </View>
      </SafeAreaView>
      {selected && <PlatformModal platform={selected} onClose={() => setSelected(null)} />}
    </Screen>
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
      if (!text.includes('# Netscape') && !text.includes('.youtube.com')) {
        setNote('That file does not look like a Netscape-format cookies.txt file.');
        return;
      }
      const path = await saveImportedCookies(platform.cookieKey, text);
      setImportedCookies(platform.cookieKey, path);
      setNote('Imported. This file will be used for all ' + platform.name + ' downloads.');
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
      <Screen>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
          <Row style={styles.modalHeader}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>{platform.name} cookies</Text>
          </Row>

          {showLogin ? (
            <View style={styles.loginBox}>
              <WebView
                source={{ uri: platform.loginUrl }}
                style={styles.web}
                javaScriptEnabled
                domStorageEnabled
                thirdPartyCookiesEnabled
                sharedCookiesEnabled
              />
              <PrimaryButton
                label="Done — save my cookies"
                onPress={() => void saveSession()}
                loading={busy}
              />
            </View>
          ) : (
            <>
              <Card style={styles.card}>
                <Text style={styles.dim}>
                  {imported
                    ? `Imported cookies.txt (${formatDate(Math.floor(imported.importedAt / 1000))})${note ? ` — ${note}` : ''}`
                    : savedSession
                      ? `Saved session (${formatDate(Math.floor(savedSession.savedAt / 1000))})${note ? ` — ${note}` : ''}`
                      : note
                        ? note
                        : 'No cookies yet.'}
                </Text>
                <Row style={styles.actions}>
                  <GhostButton
                    label="Log in"
                    onPress={() => setShowLogin(true)}
                    disabled={busy}
                    style={styles.actionBtn}
                  />
                  <GhostButton
                    label="Import cookies.txt"
                    onPress={() => void importFile()}
                    disabled={busy}
                    style={styles.actionBtn}
                  />
                </Row>
                {(imported || savedSession) && (
                  <GhostButton label="Clear cookies" onPress={clear} style={styles.clearBtn} />
                )}
              </Card>
              {!imported && !savedSession && (
                <Text style={styles.dim}>
                  Tip: after logging in, tap "Done — save my cookies" and downloads will
                  automatically use your session.
                </Text>
              )}
            </>
          )}
        </SafeAreaView>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: spacing.lg },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.md },
  dim: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  list: { gap: spacing.sm, marginTop: spacing.lg },
  card: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  rowBtn: {},
  row: { justifyContent: 'space-between' },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  modalHeader: { gap: spacing.md, marginBottom: spacing.md },
  loginBox: { flex: 1 },
  web: { flex: 1, backgroundColor: colors.bg, marginBottom: spacing.md },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1 },
  clearBtn: { marginTop: spacing.sm },
});