// Root navigation: Terms gate → Walkthrough → 5-tab main app (with a Cookies push screen).

import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator, type BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import BrowserScreen from '../screens/BrowserScreen';
import CookiesScreen from '../screens/CookiesScreen';
import DownloadScreen from '../screens/DownloadScreen';
import HistoryScreen from '../screens/HistoryScreen';
import QueueScreen from '../screens/QueueScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TermsScreen from '../screens/TermsScreen';
import WalkthroughScreen from '../screens/WalkthroughScreen';
import { usePrefs } from '../stores/prefs';
import { useSharedUrl } from '../stores/sharedUrl';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

type TabNav = BottomTabNavigationProp<Record<string, undefined>>;
type StackNav = NativeStackNavigationProp<Record<string, undefined>>;

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Browser: 'globe',
  Download: 'arrow-down-circle',
  Queue: 'list',
  History: 'time',
  Settings: 'settings',
};

function DownloadTab() {
  const navigation = useNavigation<TabNav>();
  return (
    <DownloadScreen
      onGoToQueue={() => {
        navigation.navigate('Queue');
        useSharedUrl.getState().setSharedUrl(null);
      }}
    />
  );
}

function SettingsTab() {
  const navigation = useNavigation<StackNav>();
  return <SettingsScreen onOpenCookies={() => navigation.navigate('Cookies')} />;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.border },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Browser" component={BrowserScreen} />
      <Tab.Screen name="Download" component={DownloadTab} />
      <Tab.Screen name="Queue" component={QueueScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Settings" component={SettingsTab} />
    </Tab.Navigator>
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