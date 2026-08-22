/**
 * Pure self-check for the live-episode CI sentinel refusal gate.
 *
 * No database and no episode file are touched: every marker family discovered
 * by the CI-fixture audit must be rejected when its target equals the active
 * rolling filename, and allowed for an owned fixture filename.
 */

import {
  CI_SENTINEL_PREFIXES,
  isCiSentinelExchange,
  mustRejectCiSentinelForEpisode,
} from '../services/agent-session-autosave';

const LIVE = 'episode-31.md';
const FIXTURE = 'episode-9994.md';
let failed = 0;

function assert(label: string, value: boolean): void {
  if (value) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

console.log('\n══ Episode CI Sentinel Guard Self-Check ══\n');
for (const prefix of CI_SENTINEL_PREFIXES) {
  const exchange = `**CI:** ${prefix}${Date.now()} synthetic test evidence`;
  assert(`${prefix} is recognized as a CI sentinel`, isCiSentinelExchange(exchange));
  assert(`${prefix} is rejected for the live rolling filename`, mustRejectCiSentinelForEpisode(exchange, LIVE, LIVE));
  assert(`${prefix} is allowed for an isolated fixture`, !mustRejectCiSentinelForEpisode(exchange, FIXTURE, LIVE));
}
assert('ordinary dialogue is not classified as a CI sentinel', !isCiSentinelExchange('A real Team Room message.'));
assert('ordinary dialogue is not rejected for the live rolling filename', !mustRejectCiSentinelForEpisode('A real Team Room message.', LIVE, LIVE));

if (failed > 0) {
  console.error(`\n✗ ${failed} sentinel guard assertion(s) failed.\n`);
  process.exit(1);
}
console.log(`\n✓ All ${CI_SENTINEL_PREFIXES.length} marker families are guarded.\n`);