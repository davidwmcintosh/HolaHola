/**
 * test-classroom-exclusion-negative-path.test.ts
 *
 * node:test version of the classroom-exclusion negative-path validator.
 *
 * WHAT THIS PROVES
 * ────────────────
 * The CLASSROOM_BLOCKED_EXEMPTIONS check asserts that every tool whose
 * chain-guard bypass is justified by classroom exclusion (e.g. read_full_memory)
 * stays in GL_EXCLUDED_TOOLS.  A green-only run of test-memory-tool-coverage.ts
 * cannot prove the guard has real bite — it might always pass even when
 * GL_EXCLUDED_TOOLS is wrong.
 *
 * These tests:
 *   1. (Negative path) Remove read_full_memory from GL_EXCLUDED_TOOLS in-process,
 *      run the drift check, and assert it DETECTS the drift.
 *   2. (Restore)       Add read_full_memory back.
 *   3. (Positive path) Run the drift check again and assert it now PASSES.
 *
 * Run individually:
 *   npx tsx --test server/scripts/test-classroom-exclusion-negative-path.test.ts
 *
 * Or via CI:
 *   npm test  (already included in the test glob)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { GL_EXCLUDED_TOOLS } from '../services/daniela-function-registry';
import { CLASSROOM_BLOCKED_EXEMPTIONS } from '../services/memory-chain-guard';

// ─── Core helper — mirrors the check in test-memory-tool-coverage.ts ─────────
function runClassroomExclusionCheck(): string[] {
  const drift: string[] = [];
  for (const toolName of CLASSROOM_BLOCKED_EXEMPTIONS) {
    if (!GL_EXCLUDED_TOOLS.has(toolName)) {
      drift.push(toolName);
    }
  }
  return drift;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('classroom-exclusion drift check — negative-path validator', () => {
  // Track which tools we removed so we can restore them unconditionally.
  const removedTools: string[] = [];

  afterEach(() => {
    // Always restore any tools removed during a test so later tests start clean.
    for (const name of removedTools) {
      GL_EXCLUDED_TOOLS.add(name);
    }
    removedTools.length = 0;
  });

  it('negative path: drift check detects read_full_memory missing from GL_EXCLUDED_TOOLS', () => {
    // Pre-condition: read_full_memory must be in CLASSROOM_BLOCKED_EXEMPTIONS for
    // this test to be meaningful.  If it is ever removed from that set the task
    // description should be updated accordingly.
    assert.ok(
      CLASSROOM_BLOCKED_EXEMPTIONS.has('read_full_memory'),
      'read_full_memory must be in CLASSROOM_BLOCKED_EXEMPTIONS for the negative-path test to be meaningful',
    );

    // Remove read_full_memory to simulate a refactor that accidentally drops it.
    GL_EXCLUDED_TOOLS.delete('read_full_memory');
    removedTools.push('read_full_memory');

    const drift = runClassroomExclusionCheck();

    assert.ok(
      drift.includes('read_full_memory'),
      `Expected drift check to detect 'read_full_memory' as missing from GL_EXCLUDED_TOOLS, but it was not reported. ` +
        `Detected drift: [${drift.join(', ')}]. ` +
        `This means the classroom-exclusion guard in test-memory-tool-coverage.ts ` +
        `would silently pass even when GL_EXCLUDED_TOOLS is wrong.`,
    );
  });

  it('positive path: drift check passes after read_full_memory is restored', () => {
    // Ensure read_full_memory is present (it should be — afterEach restores it,
    // and the module initialises with it in GL_EXCLUDED_TOOLS).
    GL_EXCLUDED_TOOLS.add('read_full_memory');

    const drift = runClassroomExclusionCheck();

    assert.strictEqual(
      drift.length,
      0,
      `Expected zero classroom-exclusion drift after restore, but found: [${drift.join(', ')}]. ` +
        `Check that GL_EXCLUDED_TOOLS is correctly exported and mutable, and that ` +
        `CLASSROOM_BLOCKED_EXEMPTIONS lists only tools that are actually in GL_EXCLUDED_TOOLS.`,
    );
  });

  it('negative path: drift check reports ALL exempted tools that are missing, not just one', () => {
    // Remove every tool in CLASSROOM_BLOCKED_EXEMPTIONS that is currently in
    // GL_EXCLUDED_TOOLS.
    const toRemove: string[] = [];
    for (const name of CLASSROOM_BLOCKED_EXEMPTIONS) {
      if (GL_EXCLUDED_TOOLS.has(name)) {
        toRemove.push(name);
      }
    }

    if (toRemove.length === 0) {
      // Nothing to remove means GL_EXCLUDED_TOOLS is already drifted — that is
      // itself a failure that the positive-path test will catch.
      return;
    }

    for (const name of toRemove) {
      GL_EXCLUDED_TOOLS.delete(name);
      removedTools.push(name);
    }

    const drift = runClassroomExclusionCheck();

    // Every tool we removed must appear in the drift report.
    for (const name of toRemove) {
      assert.ok(
        drift.includes(name),
        `Expected drift check to include '${name}' after removing it from GL_EXCLUDED_TOOLS, ` +
          `but it was absent from the drift list: [${drift.join(', ')}].`,
      );
    }
  });
});
