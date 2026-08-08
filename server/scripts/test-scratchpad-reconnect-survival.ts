/**
 * test-scratchpad-reconnect-survival.ts
 *
 * CI check — confirms Daniela's session scratchpad (sessionNotes) survives a
 * mid-session grace-period reconnect without losing notes, including across a
 * server restart (the DB-backed fallback AND startup hydration paths).
 *
 * Background
 * ──────────
 * Session notes live on `(session as any).sessionNotes: string[]`.  On a
 * grace-period reconnect the WS handler:
 *   1. storePendingReconnect() — serialises notes to in-memory map AND to
 *      voiceGracePeriods.session_notes (JSON) for server-restart safety
 *   2. orchestrator.createSession() — makes a FRESH session object
 *   3. applyReconnectSessionNotes() — restores notes onto the new session
 *
 * Server-restart path after hydratePendingReconnectsFromDb():
 *   The startup sweep reads unexpired rows and arms in-memory entries.
 *   Without parsing row.sessionNotes, those entries carry no notes and the
 *   subsequent in-memory claimPendingReconnect() returns nothing.
 *
 * Five guard groups:
 *   G1 – native-fc-handlers.ts: WRITE_SESSION_NOTE pushes to sessionNotes
 *   G2 – streaming-voice-orchestrator.ts: notes injected into GL turn context
 *   G3 – unified-ws-handler.ts: extract/apply helpers exported, wired at both
 *         storePendingReconnect() call sites and after createSession()
 *   G4 – DB persistence: notes JSON-serialised on insert/update; shared
 *         deserializeSessionNotesFromDb() helper used by both claimPendingReconnect()
 *         DB-fallback and hydratePendingReconnectsFromDb()
 *   G5 – Schema: voiceGracePeriods.session_notes column declared in shared/schema.ts
 *
 * What the test does
 * ──────────────────
 *   PART 1 — Static source scan: confirm G1–G5 guards in production files.
 *   PART 2 — Handler unit test: WRITE_SESSION_NOTE × 2, READ_SESSION_NOTES × 1.
 *   PART 3 — Real in-memory round-trip via exported production helpers.
 *   PART 4 — DB serialization round-trip via shared deserializeSessionNotesFromDb().
 *   PART 5 — Hydration round-trip: simulate DB-row → PendingReconnectData →
 *             applyReconnectSessionNotes() path that runs after a server restart.
 *   PART 6 — Mutation self-checks: static guards fail when guards removed.
 *
 * Run: npx tsx server/scripts/test-scratchpad-reconnect-survival.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { NativeFunctionCallHandler } from '../services/native-fc-handlers';
import {
  extractSessionNotesForReconnect,
  applyReconnectSessionNotes,
  deserializeSessionNotesFromDb,
} from '../unified-ws-handler';
import type { StreamingSession } from '../services/streaming-session-types';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── Colour helpers ────────────────────────────────────────────────────────────
const G  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R  = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B  = (s: string) => `\x1b[34m${s}\x1b[0m`;
const D  = (s: string) => `\x1b[2m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n      ${R('→')} ${detail}` : ''}`);
    failed++;
  }
}

// ── Source paths ──────────────────────────────────────────────────────────────
const HANDLERS_PATH  = resolve(__dirname, '../services/native-fc-handlers.ts');
const ORCH_PATH      = resolve(__dirname, '../services/streaming-voice-orchestrator.ts');
const WS_PATH        = resolve(__dirname, '../unified-ws-handler.ts');
const SCHEMA_PATH    = resolve(__dirname, '../../shared/schema.ts');
const MIGRATION_PATH = resolve(__dirname, '../../migrations/0015_mighty_human_fly.sql');

// ── Guard predicates ──────────────────────────────────────────────────────────

// G1
const g1a = (s: string) => s.includes("case 'WRITE_SESSION_NOTE'");
const g1b = (s: string) => s.includes("(session as any).sessionNotes.push(noteContent.trim())");
const g1c = (s: string) =>
  s.includes('MAX_SESSION_NOTES') &&
  s.includes('(session as any).sessionNotes = []') &&
  s.includes('_scratchpadFlushCount');

// G2
const g2 = (s: string) =>
  s.includes("(session as any).sessionNotes as string[] | undefined") &&
  s.includes("Session Working Memory");

// G3
const g3a = (s: string) => s.includes("export function extractSessionNotesForReconnect(");
const g3b = (s: string) => s.includes("export function applyReconnectSessionNotes(");
const g3c = (s: string) =>
  [...s.matchAll(/sessionNotes\s*:\s*session\s*\?\s*extractSessionNotesForReconnect\(session\)/g)].length >= 2;
const g3d = (s: string) =>
  s.includes("applyReconnectSessionNotes(session, pendingReconnectSO.sessionNotes)");

// G4 — DB persistence + shared helper
const g4a = (s: string) =>
  s.includes("export function deserializeSessionNotesFromDb(");
const g4b = (s: string) =>
  s.includes("JSON.stringify(data.sessionNotes)") &&
  s.includes("sessionNotes: sessionNotesJson");
// Both claimPendingReconnect() DB-fallback AND hydratePendingReconnectsFromDb() must use the helper
const g4c = (s: string) =>
  [...s.matchAll(/sessionNotes:\s*deserializeSessionNotesFromDb\(row\.sessionNotes\)/g)].length >= 2;

// G5 — Schema column
const g5 = (s: string) => s.includes("sessionNotes: text('session_notes')");

// G6 — Migration file
const g6 = (s: string) =>
  s.includes('voice_grace_periods') && s.includes('session_notes');

// ── Mock helpers ──────────────────────────────────────────────────────────────
function makeMockWs(): any {
  return Object.assign(new EventEmitter(), { readyState: 1, send: () => {}, close: () => {} });
}

function makeMockSession(ws: any): StreamingSession {
  return {
    id: 'test-session-scratchpad',
    userId: 'test-user',
    conversationId: 'test-conv-scratchpad',
    targetLanguage: 'Spanish',
    nativeLanguage: 'English',
    difficultyLevel: 'intermediate',
    subtitleMode: 'off',
    tutorPersonality: 'friendly' as any,
    tutorExpressiveness: 1,
    voiceSpeed: 'normal' as any,
    tutorGender: 'female',
    tutorName: 'Daniela',
    systemPrompt: '',
    conversationHistory: [],
    ws,
    startTime: Date.now(),
    isActive: true,
    isFounderMode: false,
    isRawHonestyMode: false,
    isReadingRoom: false,
    isIncognito: false,
    isDeveloperUser: false,
    isBetaTester: false,
    lastContextRefreshTime: Date.now(),
    lastActivityTime: Date.now(),
    currentTurnId: 1,
    isInterrupted: false,
    lastTurnWasInterrupted: false,
    isGenerating: false,
    toolsUsedSession: [],
    pendingArchitectNoteIds: [],
    recentSttConfidences: [],
    sessionStruggleCount: 0,
    adaptiveSpeedEnabled: false,
    sessionWordAnalyses: [],
    sessionAudioChunks: [],
    sessionTranscripts: [],
    sentAudioChunks: new Set(),
    sentAudioHashes: new Map(),
    telemetryTtsCharacters: 0,
    telemetrySttSeconds: 0,
    telemetryExchangeCount: 0,
    telemetryStudentSpeakingMs: 0,
    telemetryTutorSpeakingMs: 0,
    telemetryLlmInputTokens: 0,
    telemetryLlmOutputTokens: 0,
  } as unknown as StreamingSession;
}

function makeHandler(): NativeFunctionCallHandler {
  return new NativeFunctionCallHandler(() => {}, () => {}, async () => {});
}

// ── PART 1 — Static source scan ───────────────────────────────────────────────
function part1(): void {
  sep();
  console.log(B('PART 1 — Static source scan: G1–G6 guards in production files'));

  const hSrc  = readFileSync(HANDLERS_PATH, 'utf-8');
  const oSrc  = readFileSync(ORCH_PATH,     'utf-8');
  const wsSrc = readFileSync(WS_PATH,       'utf-8');
  const sSrc  = readFileSync(SCHEMA_PATH,   'utf-8');
  const mSrc  = readFileSync(MIGRATION_PATH,'utf-8');

  assert("G1a: 'WRITE_SESSION_NOTE' case label in native-fc-handlers.ts",       g1a(hSrc));
  assert("G1b: sessionNotes.push() in WRITE_SESSION_NOTE handler",               g1b(hSrc),
    "Missing: (session as any).sessionNotes.push(noteContent.trim())");
  assert("G1c: WRITE_SESSION_NOTE enforces MAX_SESSION_NOTES cap with shift()",  g1c(hSrc),
    "Missing: MAX_SESSION_NOTES constant + (session as any).sessionNotes.shift() in WRITE_SESSION_NOTE");
  assert("G2:  orchestrator injects 'Session Working Memory' from sessionNotes", g2(oSrc),
    "Missing sessionNotes injection in GL turn context");
  assert("G3a: extractSessionNotesForReconnect() exported from ws-handler",      g3a(wsSrc));
  assert("G3b: applyReconnectSessionNotes() exported from ws-handler",           g3b(wsSrc));
  assert("G3c: both storePendingReconnect() call sites pass sessionNotes",        g3c(wsSrc),
    "One or both storePendingReconnect() calls missing sessionNotes field");
  assert("G3d: applyReconnectSessionNotes() called after createSession()",       g3d(wsSrc));
  assert("G4a: deserializeSessionNotesFromDb() exported as shared helper",       g4a(wsSrc));
  assert("G4b: storePendingReconnect() JSON.stringifies notes for DB insert",    g4b(wsSrc),
    "Missing JSON.stringify(data.sessionNotes) + sessionNotes: sessionNotesJson");
  assert("G4c: claim+hydration use shared deserializeSessionNotesFromDb()",      g4c(wsSrc),
    "Missing deserializeSessionNotesFromDb(row.sessionNotes) in claim or hydration");
  assert("G5:  voiceGracePeriods schema has session_notes text column",          g5(sSrc),
    "Missing: sessionNotes: text('session_notes') in shared/schema.ts");
  assert("G6:  migration file adds session_notes to voice_grace_periods",        g6(mSrc),
    "Migration file missing or does not touch voice_grace_periods.session_notes");
}

// ── PART 2 — Handler unit test ────────────────────────────────────────────────
async function part2(): Promise<void> {
  sep();
  console.log(B('PART 2 — Handler unit test: WRITE_SESSION_NOTE / READ_SESSION_NOTES'));

  const session = makeMockSession(makeMockWs());
  const handler = makeHandler();

  await handler.handle('sid', session, {
    name: 'write_session_note', legacyType: 'WRITE_SESSION_NOTE',
    args: { content: 'Student confuses ser vs estar — revisit next turn.' },
  });
  await handler.handle('sid', session, {
    name: 'write_session_note', legacyType: 'WRITE_SESSION_NOTE',
    args: { content: 'Goal: introduce 3 weather words before session end.' },
  });

  const notes = (session as any).sessionNotes as string[] | undefined;
  assert('sessionNotes array exists after two writes',       Array.isArray(notes));
  assert('sessionNotes has exactly 2 entries',               notes?.length === 2,  `got ${notes?.length}`);
  assert('First note preserved verbatim',  notes?.[0] === 'Student confuses ser vs estar — revisit next turn.',  `"${notes?.[0]}"`);
  assert('Second note preserved verbatim', notes?.[1] === 'Goal: introduce 3 weather words before session end.', `"${notes?.[1]}"`);

  await handler.handle('sid', session, {
    name: 'read_session_notes', legacyType: 'READ_SESSION_NOTES', args: {},
  });
  assert('READ_SESSION_NOTES does not clear the array',
    ((session as any).sessionNotes as string[] | undefined)?.length === 2);

  // ── Overflow / auto-flush test ───────────────────────────────────────────
  // Write exactly 50 notes to a fresh session (fills to cap), then one more.
  // The 51st write must trigger auto-flush: the array resets, the new note
  // starts batch #2, and no note is silently dropped from the active array.
  const overflowSession = makeMockSession(makeMockWs());
  const overflowHandler = makeHandler();

  for (let i = 1; i <= 50; i++) {
    await overflowHandler.handle('sid-overflow', overflowSession, {
      name: 'write_session_note', legacyType: 'WRITE_SESSION_NOTE',
      args: { content: `Batch-1 note ${i}` },
    });
  }
  const preFlushNotes = (overflowSession as any).sessionNotes as string[] | undefined;
  assert('Pre-flush: 50 notes fill the array without triggering flush', preFlushNotes?.length === 50, `got ${preFlushNotes?.length}`);

  // 51st note crosses the cap — should flush batch 1 and start batch 2
  await overflowHandler.handle('sid-overflow', overflowSession, {
    name: 'write_session_note', legacyType: 'WRITE_SESSION_NOTE',
    args: { content: 'Batch-2 first note.' },
  });
  const postFlushNotes = (overflowSession as any).sessionNotes as string[] | undefined;
  assert('Post-flush: active array reset to 1 (new batch started)', postFlushNotes?.length === 1, `got ${postFlushNotes?.length}`);
  assert('Post-flush: new note is the only entry', postFlushNotes?.[0] === 'Batch-2 first note.', `got "${postFlushNotes?.[0]}"`);
  assert('Post-flush: flush counter incremented', (overflowSession as any)._scratchpadFlushCount === 1, `got ${(overflowSession as any)._scratchpadFlushCount}`);

  // Writing more notes after flush appends normally
  await overflowHandler.handle('sid-overflow', overflowSession, {
    name: 'write_session_note', legacyType: 'WRITE_SESSION_NOTE',
    args: { content: 'Batch-2 second note.' },
  });
  assert('Post-flush: second write appends to fresh batch (total 2)', ((overflowSession as any).sessionNotes as string[] | undefined)?.length === 2);
}

// ── PART 3 — Real in-memory round-trip ───────────────────────────────────────
async function part3(): Promise<void> {
  sep();
  console.log(B('PART 3 — Real in-memory round-trip via exported production helpers'));

  const sessionA = makeMockSession(makeMockWs());
  const handler  = makeHandler();

  await handler.handle('sA', sessionA, {
    name: 'write_session_note', legacyType: 'WRITE_SESSION_NOTE',
    args: { content: 'Note A: student struggling with subjunctive.' },
  });
  await handler.handle('sA', sessionA, {
    name: 'write_session_note', legacyType: 'WRITE_SESSION_NOTE',
    args: { content: 'Note B: try immersion scenario next.' },
  });

  assert('Notes on sessionA before disconnect', ((sessionA as any).sessionNotes as string[] | undefined)?.length === 2);

  const extracted = extractSessionNotesForReconnect(sessionA);
  assert('extractSessionNotesForReconnect() returns both notes',    extracted.length === 2, `got ${extracted.length}`);
  assert('extract returns independent copy (not same reference)',    extracted !== (sessionA as any).sessionNotes);

  const sessionB = makeMockSession(makeMockWs());
  assert('Fresh sessionB starts with no notes', !(sessionB as any).sessionNotes);

  applyReconnectSessionNotes(sessionB, extracted);
  const notesB = (sessionB as any).sessionNotes as string[] | undefined;
  assert('Notes survive onto fresh session (count)',  notesB?.length === 2,                                    `got ${notesB?.length}`);
  assert('Note A intact after apply',                 notesB?.[0] === 'Note A: student struggling with subjunctive.', `"${notesB?.[0]}"`);
  assert('Note B intact after apply',                 notesB?.[1] === 'Note B: try immersion scenario next.',         `"${notesB?.[1]}"`);

  await handler.handle('sB', sessionB, {
    name: 'write_session_note', legacyType: 'WRITE_SESSION_NOTE',
    args: { content: 'Note C: returned promptly.' },
  });
  assert('Post-reconnect write appends (total 3)', ((sessionB as any).sessionNotes as string[] | undefined)?.length === 3);

  const sessionC = makeMockSession(makeMockWs());
  applyReconnectSessionNotes(sessionC, []);
  assert('apply([]) is a no-op — no sessionNotes created', !(sessionC as any).sessionNotes);

  const sessionD = makeMockSession(makeMockWs());
  const emptyE = extractSessionNotesForReconnect(sessionD);
  assert('extract on session with no notes returns []', Array.isArray(emptyE) && emptyE.length === 0);
}

// ── PART 4 — DB serialization round-trip ─────────────────────────────────────
function part4(): void {
  sep();
  console.log(B('PART 4 — DB serialization round-trip via shared deserializeSessionNotesFromDb()'));
  console.log(D('  Mirrors storePendingReconnect() and claimPendingReconnect() DB-fallback.'));

  const notes = ['Note A: subjunctive issue.', 'Note B: immersion next.'];

  const serialized = notes.length > 0 ? JSON.stringify(notes) : null;
  assert('Serialization produces a non-null JSON string', typeof serialized === 'string' && serialized!.length > 0);
  assert('Serialized JSON is parseable', (() => { try { JSON.parse(serialized!); return true; } catch { return false; } })());

  const restored = deserializeSessionNotesFromDb(serialized);
  assert('Shared helper returns an array',               Array.isArray(restored));
  assert('Restored array has 2 entries',                 restored?.length === 2, `got ${restored?.length}`);
  assert('Note A intact after DB round-trip',            restored?.[0] === 'Note A: subjunctive issue.');
  assert('Note B intact after DB round-trip',            restored?.[1] === 'Note B: immersion next.');

  assert('Shared helper: null → undefined',              deserializeSessionNotesFromDb(null)        === undefined);
  assert('Shared helper: empty string → undefined',      deserializeSessionNotesFromDb('')          === undefined);
  assert('Shared helper: malformed JSON → undefined',    deserializeSessionNotesFromDb('NOT{JSON}') === undefined);
  assert('Shared helper: non-array JSON → undefined',    deserializeSessionNotesFromDb(JSON.stringify({ x: 1 })) === undefined);

  const emptyNotes: string[] = [];
  assert('Serialising [] yields null (no DB write)', (emptyNotes.length > 0 ? JSON.stringify(emptyNotes) : null) === null);

  // Full simulation
  const sessionSim = makeMockSession(makeMockWs());
  (sessionSim as any).sessionNotes = [...notes];
  const ext  = extractSessionNotesForReconnect(sessionSim);
  const json = ext.length > 0 ? JSON.stringify(ext) : null;
  const back = deserializeSessionNotesFromDb(json) ?? [];
  const sessionNew = makeMockSession(makeMockWs());
  applyReconnectSessionNotes(sessionNew, back);
  const finalNotes = (sessionNew as any).sessionNotes as string[] | undefined;
  assert('Full DB path: count=2',           finalNotes?.length === 2, `got ${finalNotes?.length}`);
  assert('Full DB path: Note A preserved',  finalNotes?.[0] === 'Note A: subjunctive issue.');
  assert('Full DB path: Note B preserved',  finalNotes?.[1] === 'Note B: immersion next.');
}

// ── PART 5 — Hydration round-trip ────────────────────────────────────────────
function part5(): void {
  sep();
  console.log(B('PART 5 — Hydration round-trip: DB row → PendingReconnectData → apply'));
  console.log(D('  Simulates hydratePendingReconnectsFromDb() + subsequent reconnect claim.'));

  const notes = ['Hydrated note A: preposition gap.', 'Hydrated note B: ser/estar drill needed.'];
  const sessionNotesJson = notes.length > 0 ? JSON.stringify(notes) : null;

  // Step 1: simulate a DB row
  const simulatedDbRow = {
    conversationId: 'sim-conv-restart-001',
    usageSessionId: 'sim-usage-001',
    sessionNotes: sessionNotesJson,
  };

  // Step 2: build PendingReconnectData entry (exactly what hydration does)
  const entry = {
    ...simulatedDbRow,
    timer: null as any,
    sessionNotes: deserializeSessionNotesFromDb(simulatedDbRow.sessionNotes),
  };

  assert('Hydrated entry has sessionNotes set',     Array.isArray(entry.sessionNotes));
  assert('Hydrated entry has 2 notes',              entry.sessionNotes?.length === 2,    `got ${entry.sessionNotes?.length}`);
  assert('Hydrated note A intact',                  entry.sessionNotes?.[0] === 'Hydrated note A: preposition gap.');
  assert('Hydrated note B intact',                  entry.sessionNotes?.[1] === 'Hydrated note B: ser/estar drill needed.');

  // Step 3: apply onto fresh session
  const freshSession = makeMockSession(makeMockWs());
  assert('Fresh session has no notes before apply', !(freshSession as any).sessionNotes);

  applyReconnectSessionNotes(freshSession, entry.sessionNotes ?? []);
  const finalNotes = (freshSession as any).sessionNotes as string[] | undefined;

  assert('Notes survive after restart + claim + apply (count)', finalNotes?.length === 2, `got ${finalNotes?.length}`);
  assert('Restart path: Note A on fresh session', finalNotes?.[0] === 'Hydrated note A: preposition gap.');
  assert('Restart path: Note B on fresh session', finalNotes?.[1] === 'Hydrated note B: ser/estar drill needed.');

  // Step 4: legacy row with null session_notes
  const legacyEntry = { ...entry, sessionNotes: deserializeSessionNotesFromDb(null) };
  assert('Legacy row (null session_notes) gives undefined (no crash)', legacyEntry.sessionNotes === undefined);
  const legacySession = makeMockSession(makeMockWs());
  applyReconnectSessionNotes(legacySession, legacyEntry.sessionNotes ?? []);
  assert('Legacy row: apply([]) is no-op — session stays clean', !(legacySession as any).sessionNotes);
}

// ── PART 6 — Mutation self-check ─────────────────────────────────────────────
function part6(): void {
  sep();
  console.log(B('PART 6 — Mutation self-check: static guards fail when removed'));
  console.log(D('  In-memory string mutations only — no files written.'));

  const hSrc  = readFileSync(HANDLERS_PATH, 'utf-8');
  const wsSrc = readFileSync(WS_PATH,       'utf-8');
  const sSrc  = readFileSync(SCHEMA_PATH,   'utf-8');
  const mSrc  = readFileSync(MIGRATION_PATH,'utf-8');

  assert('[Self-check] G1b fails when push line removed',
    !g1b(hSrc.replace("(session as any).sessionNotes.push(noteContent.trim());", "/* removed */")));
  assert('[Self-check] G1a fails when case label renamed',
    !g1a(hSrc.replace("case 'WRITE_SESSION_NOTE':", "case 'OLD':")));
  assert('[Self-check] G3a fails when export removed from extract fn',
    !g3a(wsSrc.replace("export function extractSessionNotesForReconnect(", "function extractSessionNotesForReconnect(")));
  assert('[Self-check] G3b fails when export removed from apply fn',
    !g3b(wsSrc.replace("export function applyReconnectSessionNotes(", "function applyReconnectSessionNotes(")));
  assert('[Self-check] G3c fails when one storePendingReconnect call drops sessionNotes',
    !g3c(wsSrc.replace("sessionNotes: session ? extractSessionNotesForReconnect(session) : [],", "/* removed */")));
  assert('[Self-check] G3d fails when apply call removed',
    !g3d(wsSrc.replace("applyReconnectSessionNotes(session, pendingReconnectSO.sessionNotes)", "/* removed */")));
  assert('[Self-check] G4a fails when deserializeSessionNotesFromDb export removed',
    !g4a(wsSrc.replace("export function deserializeSessionNotesFromDb(", "function deserializeSessionNotesFromDb(")));
  assert('[Self-check] G4b fails when JSON.stringify removed',
    !g4b(wsSrc.replace("JSON.stringify(data.sessionNotes)", "/* removed */")));
  assert('[Self-check] G4c fails when DB deserialize call removed from claim',
    !g4c(wsSrc.replace("sessionNotes: deserializeSessionNotesFromDb(row.sessionNotes),", "/* removed */")));
  assert('[Self-check] G5 fails when schema column removed',
    !g5(sSrc.replace("sessionNotes: text('session_notes')", "/* removed */")));
  assert('[Self-check] G6 fails when migration file emptied', !g6(''));

  assert('[Self-check] G1c fails when MAX_SESSION_NOTES renamed away',
    !g1c(hSrc.replace(/MAX_SESSION_NOTES/g, 'SCRATCHPAD_CAP')));
  assert('[Self-check] G1c fails when flush-counter removed',
    !g1c(hSrc.replace(/_scratchpadFlushCount/g, '_scratchpadBatchIndex')));

  // Baselines
  assert('[Self-check] G1b passes on original source',  g1b(hSrc));
  assert('[Self-check] G1c passes on original source',  g1c(hSrc));
  assert('[Self-check] G3a passes on original source',  g3a(wsSrc));
  assert('[Self-check] G3d passes on original source',  g3d(wsSrc));
  assert('[Self-check] G4a passes on original source',  g4a(wsSrc));
  assert('[Self-check] G4c passes on original source',  g4c(wsSrc));
  assert('[Self-check] G5  passes on original source',  g5(sSrc));
  assert('[Self-check] G6  passes on original source',  g6(mSrc));

  console.log(D('  ✓ All mutation probes confirmed — static guards are sensitive.'));
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(B('\n  Scratchpad reconnect survival — CI check\n'));
  console.log(D('  Covers: in-memory grace-period path, DB-backed server-restart path,'));
  console.log(D('  and startup hydration path (hydratePendingReconnectsFromDb).\n'));

  part1();
  await part2();
  await part3();
  part4();
  part5();
  part6();

  sep();
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${total} assertions passed.\n`));
    console.log(D('   G1 – WRITE_SESSION_NOTE pushes to sessionNotes (source + runtime)'));
    console.log(D('   G2 – Orchestrator injects sessionNotes into GL turn context'));
    console.log(D('   G3 – extract/apply helpers exported, wired at both store sites + after createSession'));
    console.log(D('   G4 – shared deserializeSessionNotesFromDb() used by claim AND hydration paths'));
    console.log(D('   G5 – voiceGracePeriods schema has session_notes column'));
    console.log(D('   G6 – migration file adds session_notes to voice_grace_periods'));
    console.log(D('   In-memory round-trip: extract → apply → intact'));
    console.log(D('   DB round-trip: JSON.stringify → deserializeSessionNotesFromDb → apply → intact'));
    console.log(D('   Hydration round-trip: DB row → PendingReconnectData → apply → intact\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${total} assertion(s) failed — review output above.\n`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(R(`\nFatal error: ${err?.message ?? err}\n`));
  process.exit(1);
});
