// Pre-filled GitLab issue links — port of V1's reportIssueUrl. Lets users report failures
// with version + URL + error already in the title/body.

import { Linking } from 'react-native';

const ISSUES_BASE = 'https://gitlab.com/KyriosNyx/video-plucker-mobile-v2/-/issues/new';

/** Open a pre-filled issue. Best-effort; never throws. */
export function openIssue(params: { title: string; body: string }): void {
  const query =
    `issue[title]=${encodeURIComponent(params.title)}` +
    `&issue[description]=${encodeURIComponent(params.body)}`;
  Linking.openURL(`${ISSUES_BASE}?${query}`).catch(() => {});
}

/** Open a blank issue (Settings → About). */
export function openBlankIssue(): void {
  Linking.openURL(ISSUES_BASE).catch(() => {});
}
