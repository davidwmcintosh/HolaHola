// Focused, no-DB test for applyHandoffSection -- the pure string transform
// shared by write_briefing (alden-functions.ts) and
// update-alden-handoff-section.ts. Both write paths rely on this to replace
// their own "## From <heading>" section without losing the other side's
// content, so a regex bug here would silently corrupt or drop a real
// briefing -- worth locking down independently of shared-spec-core's own
// (already thorough) CAS/conflict coverage.
import assert from 'node:assert/strict';
import { applyHandoffSection } from '../services/alden-handoff-shared-spec';

// Starting from nothing produces a titled document with just the one section.
assert.equal(
  applyHandoffSection('', 'Alden', 'First ever briefing.', 'Thu Sep 24, 2:00 PM'),
  '# Alden ↔ Agent Handoff\n\n## From Alden — last updated: Thu Sep 24, 2:00 PM\n\nFirst ever briefing.\n',
);

// Writing a heading that doesn't exist yet, alongside existing unrelated
// content, appends it with a divider rather than discarding what's there.
{
  const existing = '# Alden ↔ Agent Handoff\n\n## From Alden — last updated: Mon Sep 21, 9:00 AM\n\nEarlier Alden note.\n';
  const result = applyHandoffSection(existing, 'Agent', 'First Agent note.', 'Thu Sep 24, 2:00 PM');
  assert.match(result, /## From Alden — last updated: Mon Sep 21, 9:00 AM\n\nEarlier Alden note\./, 'existing section preserved verbatim');
  assert.match(result, /## From Agent — last updated: Thu Sep 24, 2:00 PM\n\nFirst Agent note\.\n$/, 'new section appended');
  assert.match(result, /Earlier Alden note\.\n\n---\n\n## From Agent/, 'sections separated by a divider');
}

// Replacing an existing section in place preserves the other section
// byte-for-byte, regardless of which one comes first in the document.
{
  const existing = [
    '# Alden ↔ Agent Handoff',
    '',
    '## From Alden — last updated: Mon Sep 21, 9:00 AM',
    '',
    'Stale Alden content.',
    '',
    '---',
    '',
    '## From Agent — last updated: Tue Sep 22, 10:00 AM',
    '',
    'Agent content that must survive untouched.',
    '',
  ].join('\n');
  const result = applyHandoffSection(existing, 'Alden', 'Fresh Alden content.', 'Thu Sep 24, 2:00 PM');
  assert.match(result, /## From Alden — last updated: Thu Sep 24, 2:00 PM\n\nFresh Alden content\./, 'Alden section replaced');
  assert.equal(result.includes('Stale Alden content.'), false, 'old Alden content is gone');
  assert.match(result, /## From Agent — last updated: Tue Sep 22, 10:00 AM\n\nAgent content that must survive untouched\./, 'Agent section untouched by an Alden update');
}

// Same, but updating the section that comes *second* in the document --
// confirms the "up to the next ## From or end" boundary doesn't overrun.
{
  const existing = '# Alden ↔ Agent Handoff\n\n## From Alden — last updated: A\n\nAlden body.\n\n---\n\n## From Agent — last updated: B\n\nOld agent body.\n';
  const result = applyHandoffSection(existing, 'Agent', 'New agent body.', 'C');
  assert.match(result, /## From Alden — last updated: A\n\nAlden body\./, 'earlier Alden section untouched by an Agent update');
  assert.match(result, /## From Agent — last updated: C\n\nNew agent body\.\n$/, 'Agent section replaced and terminates the document');
  assert.equal(result.includes('Old agent body.'), false);
}

// A heading is escaped as a literal in the regex, not interpreted -- one of
// the two headings in practice is always "Alden" or "Agent", but the
// function itself must not silently misbehave if that ever changes.
{
  const existing = '## From A.* — last updated: X\n\nLiteral dot-star body.\n';
  const result = applyHandoffSection(existing, 'A.*', 'Replaced.', 'Y');
  assert.match(result, /## From A\.\* — last updated: Y\n\nReplaced\.\n$/);
}

// Round-trip: Alden writes, then Agent writes on top of that result, then
// Alden writes again -- each step must leave the other's most recent content
// alone.
{
  let doc = applyHandoffSection('', 'Alden', 'Alden #1', 'T1');
  doc = applyHandoffSection(doc, 'Agent', 'Agent #1', 'T2');
  doc = applyHandoffSection(doc, 'Alden', 'Alden #2', 'T3');
  assert.equal(doc.includes('Alden #1'), false, 'Alden #1 was superseded');
  assert.match(doc, /## From Alden — last updated: T3\n\nAlden #2/);
  assert.match(doc, /## From Agent — last updated: T2\n\nAgent #1/, 'Agent #1 survives two later Alden writes');
}

console.log('alden handoff section transform tests passed');
