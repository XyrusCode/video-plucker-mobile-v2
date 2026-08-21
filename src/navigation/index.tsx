// Root navigation: Terms gate → Walkthrough → 5-tab main app (with a Cookies push screen).
// The bottom tab bar is a floating, detached, fully-rounded "glass" bar (expo-blur). On
// Android it uses the BlurTargetView → BlurView pair so the blur actually renders (SDK 55+
// Android support), not just a semi-transparent tint.

import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator, type BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createNavigationContainerRef, useNavigation } from '@react-navigation/native';
import { BlurView, BlurTargetView } from 'expo-blur';
import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BrowserScreen from '../screens/BrowserScreen';
import CookiesScreen from '../screens/CookiesScreen';
import DownloadScreen from '../screens/DownloadScreen';
import HistoryScreen from '../screens/HistoryScreen';
import QueueScreen from '../screens/QueueScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TermsScreen from '../screens/TermsScreen';
import WalkthroughScreen from '../screens/WalkthroughScreen';
import { usePrefs } from '../stores/prefs';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/** Lets App.tsx route shared/deep-link URLs to the Download tab from outside the tree. */
export const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();

type TabNav = BottomTabNavigationProp<Record<string, undefined>>;
type StackNav = NativeStackNavigationProp<Record<string, undefined>>;

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Browser: 'globe',
  Download: 'arrow-down-circle',
  Queue: 'list',
  History: 'time',
  Settings: 'settings',
};

/** Floating glass bar: fully-rounded (pill), detached from the screen edges, blurred. */
const TAB_BAR_HEIGHT = 64;

function DownloadTab() {
  const navigation = useNavigation<TabNav>();
  return (
    <DownloadScreen
      onGoToQueue={() => {
        navigation.navigate('Queue');
      }}
    />
  );
}

function SettingsTab() {
  const navigation = useNavigation<StackNav>();
  return <SettingsScreen onOpenCookies={() => navigation.navigate('Cookies')} />;
}

function MainTabs() {
  const browserEnabled = usePrefs((s) => s.browserEnabled);
  const insets = useSafeAreaInsets();
  // Android blur: BlurTargetView captures the scene layer beneath the bar; the tab bar's
  // BlurView samples it via this ref. One target for the whole tab bar (docs pattern).
  const blurTargetRef = useRef<View | null>(null);
  const barBottom = Math.max(insets.bottom, 12);

  return (
    <BlurTargetView ref={blurTargetRef} style={styles.blurTarget}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textDim,
          tabBarStyle: [
            styles.tabBar,
            { bottom: barBottom, height: TAB_BAR_HEIGHT },
          ],
          tabBarItemStyle: styles.tabItem,
          tabBarLabelStyle: styles.tabLabel,
          sceneStyle: { paddingBottom: barBottom + TAB_BAR_HEIGHT + 12 },
          tabBarBackground: () => (
            <BlurView
              blurTarget={blurTargetRef}
              blurMethod="dimezisBlurViewSdk31Plus"
              tint="dark"
              intensity={60}
              style={StyleSheet.absoluteFill}
            />
          ),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
          ),
        })}
      >
        {browserEnabled && <Tab.Screen name="Browser" component={BrowserScreen} />}
        <Tab.Screen name="Download" component={DownloadTab} />
        <Tab.Screen name="Queue" component={QueueScreen} />
        <Tab.Screen name="History" component={HistoryScreen} />
        <Tab.Screen name="Settings" component={SettingsTab} />
      </Tab.Navigator>
    </BlurTargetView>
  );
}

export default function RootNavigator() {
  const acceptedTerms = usePrefs((s) => s.acceptedTerms);
  const walkthroughDone = usePrefs((s) => s.walkthroughDone);

  // Gate order mirrors V1: terms first, then the walkthrough, then the app.
  if (!acceptedTerms) return <TermsScreen />;
  if (!walkthroughDone) return <WalkthroughScreen />;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen
        name="Cookies"
        component={CookiesScreen}
        options={{
          headerShown: true,
          title: 'Cookie Manager',
          headerStyle: { backgroundColor: colors.panel },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  blurTarget: { flex: 1 },
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: TAB_BAR_HEIGHT / 2,
    backgroundColor: 'rgba(24, 27, 34, 0.55)',
    borderTopWidth: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 14,
  },
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 0 },
});