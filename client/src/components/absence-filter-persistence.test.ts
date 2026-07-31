/**
 * Unit tests for the absence-history filter localStorage persistence helpers.
 *
 * Imports the REAL production helpers from client/src/lib/absence-filter-storage.ts
 * so that regressions in key name, valid-value list, or fallback behaviour are
 * caught here rather than silently passing through a mirrored re-implementation.
 *
 * Run with:
 *   npx tsx --test client/src/components/absence-filter-persistence.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 * localStorage is shimmed with a plain Map for the Node environment.
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Shim localStorage before importing the production module ─────────────────
// The helpers call localStorage.getItem / setItem; Node has no global
// localStorage, so we inject a minimal Map-backed shim into globalThis.

const store = new Map<string, string>();

const localStorageShim = {
  getItem(key: string): string | null {
    return store.has(key) ? (store.get(key) as string) : null;
  },
  setItem(key: string, value: string): void {
    store.set(key, value);
  },
  removeItem(key: string): void {
    store.delete(key);
  },
  clear(): void {
    store.clear();
  },
};

// @ts-ignore — globalThis.localStorage does not exist in Node; we add it.
globalThis.localStorage = localStorageShim;

// ── Import the REAL production helpers ───────────────────────────────────────
import {
  ABSENCE_FILTER_KEY,
  readAbsenceFilterFromStorage,
  writeAbsenceFilterToStorage,
} from '../lib/absence-filter-storage.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('absence filter — localStorage persistence (real helpers)', () => {
  beforeEach(() => {
    store.clear();
  });

  // ── Valid stored values ──────────────────────────────────────────────────

  it('restores "all" from localStorage', () => {
    store.set(ABSENCE_FILTER_KEY, 'all');
    assert.equal(readAbsenceFilterFromStorage(), 'all');
  });

  it('restores "student_returned" from localStorage', () => {
    store.set(ABSENCE_FILTER_KEY, 'student_returned');
    assert.equal(readAbsenceFilterFromStorage(), 'student_returned');
  });

  it('restores "message_queued" from localStorage', () => {
    store.set(ABSENCE_FILTER_KEY, 'message_queued');
    assert.equal(readAbsenceFilterFromStorage(), 'message_queued');
  });

  it('restores "dismissed" from localStorage', () => {
    store.set(ABSENCE_FILTER_KEY, 'dismissed');
    assert.equal(readAbsenceFilterFromStorage(), 'dismissed');
  });

  // ── Invalid / missing stored values ─────────────────────────────────────

  it('falls back to "all" when storage is empty', () => {
    assert.equal(readAbsenceFilterFromStorage(), 'all');
  });

  it('falls back to "all" for an invalid stored value ("bogus")', () => {
    store.set(ABSENCE_FILTER_KEY, 'bogus');
    assert.equal(readAbsenceFilterFromStorage(), 'all');
  });

  it('falls back to "all" for an empty string stored value', () => {
    store.set(ABSENCE_FILTER_KEY, '');
    assert.equal(readAbsenceFilterFromStorage(), 'all');
  });

  it('falls back to "all" for a partial match ("return")', () => {
    store.set(ABSENCE_FILTER_KEY, 'return');
    assert.equal(readAbsenceFilterFromStorage(), 'all');
  });

  it('falls back to "all" for a numeric stored value ("0")', () => {
    store.set(ABSENCE_FILTER_KEY, '0');
    assert.equal(readAbsenceFilterFromStorage(), 'all');
  });

  // ── Write + read-back round trips ────────────────────────────────────────

  it('writes and reads back "student_returned" correctly', () => {
    writeAbsenceFilterToStorage('student_returned');
    assert.equal(readAbsenceFilterFromStorage(), 'student_returned');
  });

  it('writes and reads back "message_queued" correctly', () => {
    writeAbsenceFilterToStorage('message_queued');
    assert.equal(readAbsenceFilterFromStorage(), 'message_queued');
  });

  it('writes and reads back "dismissed" correctly', () => {
    writeAbsenceFilterToStorage('dismissed');
    assert.equal(readAbsenceFilterFromStorage(), 'dismissed');
  });

  it('writes and reads back "all" correctly', () => {
    // Start from a different value so the write is observable.
    store.set(ABSENCE_FILTER_KEY, 'dismissed');
    writeAbsenceFilterToStorage('all');
    assert.equal(readAbsenceFilterFromStorage(), 'all');
  });

  it('overwriting a stale/invalid value with a valid filter persists the new value', () => {
    store.set(ABSENCE_FILTER_KEY, 'bogus');
    writeAbsenceFilterToStorage('message_queued');
    assert.equal(readAbsenceFilterFromStorage(), 'message_queued');
  });

  // ── Storage key contract ─────────────────────────────────────────────────

  it('uses the expected storage key "absence-history-filter"', () => {
    assert.equal(ABSENCE_FILTER_KEY, 'absence-history-filter');
  });

  it('writeAbsenceFilterToStorage stores under the correct key', () => {
    writeAbsenceFilterToStorage('dismissed');
    assert.equal(store.get(ABSENCE_FILTER_KEY), 'dismissed');
  });
});
