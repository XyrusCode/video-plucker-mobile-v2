// Pre-filled GitHub issue links — port of V1's reportIssueUrl. Lets users report failures
// with version + URL + error already in the title/body.

import { Linking } from 'react-native';

const REPO = 'XyrusCode/video-plucker-v2';

/** Open a pre-filled issue. Best-effort; never throws. */
export function openIssue(params: { title: string; body: string }): void {
  const query = `title=${encodeURIComponent(params.title)}&body=${encodeURIComponent(params.body)}`;
  Linking.openURL(`https://github.com/${REPO}/issues/new?${query}`).catch(() => {});
}

/** Open a blank issue (Settings → About). */
export function openBlankIssue(): void {
  Linking.openURL(`https://github.com/${REPO}/issues/new`).catch(() => {});
}
