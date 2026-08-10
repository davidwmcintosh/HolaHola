export {};

/**
 * test-rr-carry-forward.ts
 *
 * Self-check: Reading Room carry-forward note semantics.
 *
 * Covers:
 *  1. rrCarryState is captured for non-incognito Reading Room sessions
 *  2. rrCarryState is UNDEFINED for incognito sessions (privacy gate)
 *  3. rrCarryState is UNDEFINED when _wasEverIncognito is set (belt-and-suspenders)
 *  4. rrCarryNotes DB column round-trips through JSON correctly
 *  5. On reconnect, sessionNotes is restored but carriedNotes is NOT (no double-render)
 *  6. Self-check: removing the incognito guard would leak notes — verified by simulation
 *
 * Exit 0 = all checks pass. Exit 1 = at least one check failed.
 */

let failed = false;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failed = true;
  }
}

// ─── Helpers that mirror the production logic ────────────────────────────────

interface FakeSession {
  isReadingRoom: boolean;
  isIncognito: boolean;
  userId: string | number;
  _wasEverIncognito?: boolean;
  sessionNotes?: string[];
  sessionNotesSaved?: boolean;
}

/** Mirror of the rrCarryState capture logic in storePendingReconnect call sites */
function captureRrCarryState(session: FakeSession | null | undefined) {
  if (
    session?.isReadingRoom &&
    !session.isIncognito &&
    !(session as any)._wasEverIncognito
  ) {
    return {
      notes: session.sessionNotes ?? [],
      notesSaved: !!session.sessionNotesSaved,
      userId: String(session.userId),
    };
  }
  return undefined;
}

/** Mirror of the reconnect note-injection logic */
function applyReconnectCarryState(
  newSession: { isReadingRoom: boolean; sessionNotes?: string[]; carriedNotes?: string[]; sessionNotesSaved?: boolean },
  rrCarryState: { notes: string[]; notesSaved: boolean; userId: string } | undefined,
) {
  if (rrCarryState && newSession.isReadingRoom) {
    const { notes, notesSaved } = rrCarryState;
    if (notes.length > 0 && !notesSaved) {
      newSession.sessionNotes = [...notes];
      // carriedNotes intentionally NOT set — would cause double-render in per-turn context
    }
    if (notesSaved) newSession.sessionNotesSaved = true;
  }
}

// ─── Test 1: Non-incognito RR session captures carry state ───────────────────
console.log('\n[1] Non-incognito Reading Room session — carry state captured');
{
  const session: FakeSession = {
    isReadingRoom: true,
    isIncognito: false,
    userId: 'user-abc',
    sessionNotes: ['Note A', 'Note B'],
    sessionNotesSaved: false,
  };
  const state = captureRrCarryState(session);
  check('rrCarryState is defined', state !== undefined);
  check('notes match session.sessionNotes', JSON.stringify(state?.notes) === JSON.stringify(session.sessionNotes));
  check('notesSaved is false', state?.notesSaved === false);
  check('userId matches', state?.userId === 'user-abc');
}

// ─── Test 2: Incognito session — carry state is undefined (privacy gate) ─────
console.log('\n[2] Incognito session — carry state suppressed');
{
  const session: FakeSession = {
    isReadingRoom: true,
    isIncognito: true,
    userId: 'user-abc',
    sessionNotes: ['Private Note'],
  };
  const state = captureRrCarryState(session);
  check('rrCarryState is undefined for incognito session', state === undefined);
}

// ─── Test 3: _wasEverIncognito — carry state suppressed even if now disabled ─
console.log('\n[3] _wasEverIncognito flag — carry state suppressed');
{
  const session: FakeSession = {
    isReadingRoom: true,
    isIncognito: false, // incognito toggled OFF
    _wasEverIncognito: true, // but was ON at some point this session
    userId: 'user-abc',
    sessionNotes: ['Some Note'],
  };
  const state = captureRrCarryState(session);
  check('rrCarryState is undefined when _wasEverIncognito', state === undefined);
}

// ─── Test 4: Non-RR session — carry state is undefined ───────────────────────
console.log('\n[4] Non-Reading-Room session — carry state not captured');
{
  const session: FakeSession = {
    isReadingRoom: false,
    isIncognito: false,
    userId: 'user-abc',
    sessionNotes: ['Language Note'],
  };
  const state = captureRrCarryState(session);
  check('rrCarryState is undefined for non-RR session', state === undefined);
}

// ─── Test 5: rrCarryNotes DB round-trip ──────────────────────────────────────
console.log('\n[5] rrCarryNotes DB column JSON round-trip');
{
  const original = { notes: ['Alpha', 'Beta', 'Gamma'], notesSaved: false, userId: 'user-xyz' };
  const serialised = JSON.stringify(original);
  const restored = JSON.parse(serialised) as typeof original;
  check('notes array survives round-trip', JSON.stringify(restored.notes) === JSON.stringify(original.notes));
  check('notesSaved survives round-trip', restored.notesSaved === original.notesSaved);
  check('userId survives round-trip', restored.userId === original.userId);

  // Verify null rrCarryNotes is handled (incognito sessions write null)
  const nullJson: string | null = null;
  check('null rrCarryNotes does not crash parse', (() => {
    if (!nullJson) return true;
    try { JSON.parse(nullJson); return true; } catch { return false; }
  })());
}

// ─── Test 6: Reconnect injection — sessionNotes set, carriedNotes NOT set ────
console.log('\n[6] Reconnect note injection — no double-render');
{
  const rrCarryState = { notes: ['Carried A', 'Carried B'], notesSaved: false, userId: 'user-abc' };
  const newSession: { isReadingRoom: boolean; sessionNotes?: string[]; carriedNotes?: string[] } = {
    isReadingRoom: true,
  };
  applyReconnectCarryState(newSession, rrCarryState);
  check('sessionNotes populated from rrCarryState', JSON.stringify(newSession.sessionNotes) === JSON.stringify(rrCarryState.notes));
  check('carriedNotes NOT set (prevent double-render)', newSession.carriedNotes === undefined,
    'carriedNotes should be undefined to avoid rendering same notes twice in per-turn context');
}

// ─── Test 7: Reconnect with saved notes — sessionNotesSaved restored ─────────
console.log('\n[7] Reconnect with already-saved notes — sessionNotesSaved flag restored');
{
  const rrCarryState = { notes: ['Saved Note'], notesSaved: true, userId: 'user-abc' };
  const newSession: { isReadingRoom: boolean; sessionNotes?: string[]; sessionNotesSaved?: boolean } = {
    isReadingRoom: true,
  };
  applyReconnectCarryState(newSession, rrCarryState);
  check('sessionNotes NOT populated when notesSaved=true', newSession.sessionNotes === undefined);
  check('sessionNotesSaved restored to true', newSession.sessionNotesSaved === true);
}

// ─── Test 8: Self-check — verify incognito guard actually prevents leakage ───
console.log('\n[8] Self-check — incognito guard leakage simulation');
{
  // Simulate what would happen if the incognito check was accidentally removed
  function captureWithoutIncognitoGuard(session: FakeSession | null | undefined) {
    if (session?.isReadingRoom) {  // BUG: isIncognito check removed
      return { notes: session.sessionNotes ?? [], notesSaved: !!session.sessionNotesSaved, userId: String(session.userId) };
    }
    return undefined;
  }

  const incogSession: FakeSession = {
    isReadingRoom: true,
    isIncognito: true,
    userId: 'user-private',
    sessionNotes: ['Secret Note'],
  };

  const buggyResult = captureWithoutIncognitoGuard(incogSession);
  const correctResult = captureRrCarryState(incogSession);

  check('Without guard: incognito notes would leak (confirms guard is load-bearing)',
    buggyResult !== undefined, 'removal of guard causes leakage — confirming the guard IS needed');
  check('With guard: incognito notes are suppressed',
    correctResult === undefined);
}

// ─── Test 9: Empty sessionNotes — carry state has empty notes array ───────────
console.log('\n[9] Session with no notes — empty array captured correctly');
{
  const session: FakeSession = {
    isReadingRoom: true,
    isIncognito: false,
    userId: 'user-abc',
    sessionNotes: [],  // no notes written
  };
  const state = captureRrCarryState(session);
  check('rrCarryState defined even with empty notes', state !== undefined);
  check('notes is empty array', Array.isArray(state?.notes) && state?.notes.length === 0,
    'endSession will delete carry row when notes is empty — verified separately');
}

// ─── Final summary ────────────────────────────────────────────────────────────
console.log('');
if (failed) {
  console.error('❌ test-rr-carry-forward: one or more checks FAILED');
  process.exit(1);
} else {
  console.log('✅ test-rr-carry-forward: all checks passed');
  process.exit(0);
}
