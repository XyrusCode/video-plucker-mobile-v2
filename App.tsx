import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { addSharedUrlListener } from 'yt-pluck';
import { GluestackUIProvider } from './components/ui/gluestack-ui-provider';
import RootNavigator, { navigationRef } from './src/navigation';
import { initRemoteConfig } from './src/services/remoteConfig';
import { initSentry } from './src/services/sentry';
import { bootEngine } from './src/services/engine';
import { subscribeToJobEvents } from './src/stores/jobs';
import { useSharedUrl } from './src/stores/sharedUrl';
import YtPluckModule from 'yt-pluck';

export default function App() {
  const [ready, setReady] = React.useState(false);

  const pendingTabNav = React.useRef(false);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      // Each boot step is isolated: a failure in one service must never block the UI
      // from mounting (a stuck `ready=false` renders a permanent black screen).
      await Promise.allSettled([
        Promise.resolve().then(() => initSentry()),
        Promise.resolve().then(() => subscribeToJobEvents()),
        initRemoteConfig(),
        bootEngine(),
      ]);
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

  // A shared URL (share sheet / deep link / browser Pluck) always lands on the Download tab.
  // Navigate from outside the tree — on first launch the navigator isn't mounted yet, so queue
  // the navigation until the container signals ready.
  React.useEffect(() => {
    return useSharedUrl.subscribe((state, prev) => {
      if (state.nonce === 0 || state.nonce === prev.nonce) return;
      if (navigationRef.isReady()) {
        navigationRef.navigate('Main', { screen: 'Download' });
      } else {
        pendingTabNav.current = true;
      }
    });
  }, [pendingTabNav]);

  if (!ready) return null;

  return (
    <GluestackUIProvider mode="dark">
      <SafeAreaProvider>
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            if (pendingTabNav.current) {
              pendingTabNav.current = false;
              navigationRef.navigate('Main', { screen: 'Download' });
            }
          }}
        >
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GluestackUIProvider>
  );
}