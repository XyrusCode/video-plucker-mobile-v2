import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { addSharedUrlListener } from 'yt-pluck';
import RootNavigator from './src/navigation';
import { initRemoteConfig } from './src/services/remoteConfig';
import { initSentry } from './src/services/sentry';
import { bootEngine } from './src/services/engine';
import { subscribeToJobEvents } from './src/stores/jobs';
import { useSharedUrl } from './src/stores/sharedUrl';
import YtPluckModule from 'yt-pluck';

export default function App() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      initSentry();
      subscribeToJobEvents();
      await initRemoteConfig();
      await bootEngine();
      if (!mounted) return;
      setReady(true);
    })();

    // Startup race: a share/deep link may have arrived before the JS bridge was up — drain
    // the native side once (the module holds only the most recent payload).
    const initial = YtPluckModule.getInitialSharedUrl();
    if (initial && mounted) useSharedUrl.getState().setSharedUrl(initial);

    // Live shares/deep links while the app is running.
    const sub = addSharedUrlListener((event) => {
      useSharedUrl.getState().setSharedUrl(event.url);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}