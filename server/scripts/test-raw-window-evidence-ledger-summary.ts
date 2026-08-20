import {
  summarizeRawWindowEvidenceLedgerRows,
  type RawWindowEvidenceLedgerRow,
} from '../services/raw-window-evidence-ledger';

const rows: RawWindowEvidenceLedgerRow[] = [
  {
    sessionId: 'raw-window:unfinished',
    eventType: 'raw_window_source_observed',
    payloadJson: {
      rawSourcePath: '/home/runner/workspace/.local/real-source.txt',
      reconciliation: { status: 'resolved', unexplainedBytes: 0 },
    },
  },
  {
    sessionId: 'raw-window:unfinished',
    eventType: 'raw_window_projection_started',
    payloadJson: { reason: 'capture began' },
  },
  {
    sessionId: 'raw-window:complete',
    eventType: 'raw_window_source_observed',
    payloadJson: {
      rawSourcePath: '/home/runner/workspace/.local/complete-source.txt',
      reconciliation: { status: 'unresolved', unexplainedBytes: 17 },
    },
  },
  {
    sessionId: 'raw-window:complete',
    eventType: 'raw_window_projection_started',
    payloadJson: { reason: 'capture began' },
  },
  {
    sessionId: 'raw-window:complete',
    eventType: 'raw_window_projection_audited',
    payloadJson: { disposition: 'capture-staged' },
  },
  {
    // A legacy disposable local capture must never influence live status.
    sessionId: 'raw-window:tmp-fixture',
    eventType: 'raw_window_source_observed',
    payloadJson: { rawSourcePath: '/tmp/raw-window-fixture.txt' },
  },
  {
    sessionId: 'raw-window:tmp-fixture',
    eventType: 'raw_window_projection_started',
    payloadJson: {},
  },
];

const summary = summarizeRawWindowEvidenceLedgerRows(rows);
if (summary.sourceCount !== 2) {
  throw new Error(`Expected two workspace source events, got ${summary.sourceCount}.`);
}
if (summary.unresolvedSources !== 1 || summary.unresolvedBytes !== 17) {
  throw new Error(`Expected one unresolved 17-byte source, got ${JSON.stringify(summary)}.`);
}
if (summary.incompleteProjections !== 1) {
  throw new Error(
    `Expected only started/no-result source to remain incomplete, got ${summary.incompleteProjections}.`,
  );
}

console.log('[raw-window-ledger-summary] PASS — source-backed sessions aggregate all events; capture-staged clears only its own projection.');