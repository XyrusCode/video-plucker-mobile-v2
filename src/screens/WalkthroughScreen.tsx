// First-run walkthrough — three quick cards, then a one-time permissions step, then the app.

import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import React from 'react';
import { Platform, View } from 'react-native';
import { PermissionsAndroid, type Permission } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ButtonSpinner, ButtonText } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Text } from '../../components/ui/text';
import { usePrefs } from '../stores/prefs';

const STEPS = [
  {
    title: 'Browse any video site',
    body: 'Open YouTube, X, TikTok or any of the 7 supported sites in the built-in browser. A Pluck button appears on video pages.',
  },
  {
    title: 'Pick a quality',
    body: 'From audio-only MP3/M4A up to 4K, and Image for TikTok photo posts. Downloads run in the background with progress in the notification.',
  },
  {
    title: 'Found in your gallery',
    body: 'Finished videos land in your Movies, Pictures and Music folders under "Video Plucker" — no hidden file access needed.',
  },
  {
    title: 'One-time permissions',
    body: 'Notifications keep your downloads running smoothly, the camera lets you sign in with QR codes, and "Allow app installs" lets Video Plucker install its own updates.',
    actions: true,
  },
];

const RUNTIME_PERMISSIONS: Permission[] = ['android.permission.POST_NOTIFICATIONS', 'android.permission.CAMERA'];

export default function WalkthroughScreen() {
  const finishWalkthrough = usePrefs((s) => s.finishWalkthrough);
  const [step, setStep] = React.useState(0);
  const [permNote, setPermNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const current = STEPS[step];

  const requestRuntime = async () => {
    setBusy(true);
    setPermNote(null);
    try {
      const results = await PermissionsAndroid.requestMultiple(RUNTIME_PERMISSIONS);
      const granted = Object.values(results).filter((r) => r === PermissionsAndroid.RESULTS.GRANTED).length;
      const total = Object.keys(results).length;
      setPermNote(
        granted === total
          ? 'All permissions granted.'
          : `${granted} of ${total} granted — you can change these anytime in system Settings.`
      );
    } catch {
      setPermNote('Could not request permissions right now.');
    } finally {
      setBusy(false);
    }
  };

  const allowInstalls = async () => {
    setPermNote(null);
    try {
      const androidId = await Application.getAndroidId();
      await IntentLauncher.startActivityAsync(
        'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
        { data: `package:${androidId}` }
      );
    } catch {
      setPermNote('Could not open the install-permission setting.');
    }
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finishWalkthrough();
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 justify-between bg-background px-6 py-6">
      <View className="mb-6 flex-row gap-2">
        {STEPS.map((_, i) => (
          <View
            key={i}
            className={i === step ? 'h-2 w-[22px] rounded-full bg-primary' : 'h-2 w-2 rounded-full bg-secondary'}
          />
        ))}
      </View>
      <View className="flex-1 justify-center">
        <Text size="3xl" bold className="mb-3">
          {current.title}
        </Text>
        <Text size="lg" className="leading-[23px] text-muted-foreground">
          {current.body}
        </Text>
        {current.actions && Platform.OS === 'android' && (
          <View className="mt-4 gap-4">
            <Button onPress={() => void requestRuntime()} disabled={busy}>
              {busy ? <ButtonSpinner color="#fff" /> : <ButtonText>Enable notifications & camera</ButtonText>}
            </Button>
            <Button variant="outline" onPress={() => void allowInstalls()}>
              <ButtonText>Allow app installs</ButtonText>
            </Button>
            {permNote && <Text size="sm" className="leading-[19px] text-muted-foreground">{permNote}</Text>}
          </View>
        )}
      </View>
      <View className="mt-6 flex-row gap-4">
        {step < STEPS.length - 1 ? (
          <Button variant="outline" onPress={finishWalkthrough}>
            <ButtonText>Skip</ButtonText>
          </Button>
        ) : (
          <Button variant="outline" onPress={() => setStep((s) => Math.max(0, s - 1))}>
            <ButtonText>Back</ButtonText>
          </Button>
        )}
        <Button onPress={next} className="flex-1">
          <ButtonText>{step < STEPS.length - 1 ? 'Next' : 'Get Started'}</ButtonText>
        </Button>
      </View>
    </SafeAreaView>
  );
}