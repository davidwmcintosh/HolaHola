import { readFileSync } from 'fs';

import { closeDbConnections } from '../db';
import { prepareRawReplitEvents } from '../services/raw-replit-capture';

function expectThrows(label: string, fn: () => void): void {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(`${label} did not fail closed.`);
}

async function main(): Promise<void> {
  const prepared = prepareRawReplitEvents([
    {
      sequenceNumber: 2,
      eventType: 'luca-output',
      payloadText: 'Luca source\nwith UTF-8: ñ',
      idempotencyKey: 'luca-output',
    },
    {
      sequenceNumber: 1,
      eventType: 'david-message',
      payloadText: 'David source',
      idempotencyKey: 'david-message',
    },
  ]);

  if (prepared[0]?.sequenceNumber !== 1 || prepared[1]?.sequenceNumber !== 2) {
    throw new Error('Raw events were not normalized into source sequence order.');
  }
  if (prepared[1]?.payloadByteCount !== Buffer.byteLength('Luca source\nwith UTF-8: ñ', 'utf8')) {
    throw new Error('Raw event byte count does not preserve UTF-8 source bytes.');
  }
  if (!/^[a-f0-9]{64}$/.test(prepared[0]?.payloadSha256 ?? '')) {
    throw new Error('Raw event SHA-256 is not a canonical 64-character hex hash.');
  }

  expectThrows('duplicate raw sequence', () => prepareRawReplitEvents([
    { sequenceNumber: 1, eventType: 'a', payloadText: 'first', idempotencyKey: 'first' },
    { sequenceNumber: 1, eventType: 'b', payloadText: 'second', idempotencyKey: 'second' },
  ]));
  expectThrows('duplicate raw idempotency key', () => prepareRawReplitEvents([
    { sequenceNumber: 1, eventType: 'a', payloadText: 'first', idempotencyKey: 'same' },
    { sequenceNumber: 2, eventType: 'b', payloadText: 'second', idempotencyKey: 'same' },
  ]));
  expectThrows('empty raw source stream', () => prepareRawReplitEvents([]));

  // Guard the integration ordering without writing a synthetic test turn to
  // canonical capture. The raw ledger call must appear before the first append.
  const recordExchange = readFileSync('server/scripts/record-exchange.ts', 'utf8');
  const rawCall = recordExchange.indexOf('await persistRecordExchangeRawCapture(');
  const davidAppend = recordExchange.indexOf("appendChatCaptureTurn('David', davidText)");
  if (rawCall === -1 || davidAppend === -1 || rawCall > davidAppend) {
    throw new Error('record-exchange can append chat capture before raw source persistence.');
  }
  const completeEnvelope = "lucaText,\n      Buffer.from(lucaText, 'utf8')";
  if (
    !recordExchange.includes(completeEnvelope)
    || recordExchange.includes('lucaMainBytes.toString(\'utf8\'),\n      lucaMainBytes')
  ) {
    throw new Error('record-exchange raw Luca event does not use the complete four-channel payload written to chat capture.');
  }

  console.log('[raw-replit-capture] PASS — raw source ordering, byte preservation, and fail-closed identity guards verified.');
}

main()
  .finally(async () => {
    await closeDbConnections();
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });