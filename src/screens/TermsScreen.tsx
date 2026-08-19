// Terms gate — port of V1's TermsScreen. Static, dark-themed, scrollable.

import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ButtonText } from '../../components/ui/button';
import { Text } from '../../components/ui/text';
import { usePrefs } from '../stores/prefs';

export default function TermsScreen() {
  const acceptTerms = usePrefs((s) => s.acceptTerms);
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background px-4 pb-6">
      <ScrollView contentContainerClassName="pb-4" showsVerticalScrollIndicator={false}>
        <Text size="2xl" bold className="mb-4">
          Terms of Use
        </Text>
        <Text size="md" className="mb-3 leading-[21px] text-muted-foreground">
          Video Plucker lets you download videos and audio from YouTube, X/Twitter, TikTok,
          Instagram, Facebook, Reddit and VK. By using this app you agree to the following:
        </Text>
        <Text size="md" className="mb-3 leading-[21px] text-muted-foreground">
          • Only download content you have the right to save — respect copyright, platform
          terms, and the creators you're downloading from. Downloads are for personal,
          non-commercial use.
        </Text>
        <Text size="md" className="mb-3 leading-[21px] text-muted-foreground">
          • Login sessions and cookies are stored on your device only and are used solely to
          fetch content you're allowed to access. They are never transmitted to us.
        </Text>
        <Text size="md" className="mb-3 leading-[21px] text-muted-foreground">
          • Some sites change how their content is delivered. Downloads may fail; we work to
          keep the app compatible but don't guarantee any specific video is downloadable.
        </Text>
        <Text size="md" className="mb-3 leading-[21px] text-muted-foreground">
          • This app is provided "as is" without warranty of any kind.
        </Text>
        <Text size="md" className="leading-[21px] text-muted-foreground">
          You can stop using the app at any time. Uninstalling it removes its data from your
          device.
        </Text>
      </ScrollView>
      <Button onPress={acceptTerms} className="mt-2">
        <ButtonText>I Agree</ButtonText>
      </Button>
    </SafeAreaView>
  );
}