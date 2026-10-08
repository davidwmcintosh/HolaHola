/**
 * Local Read-only Worker v1 — staging writer and result validation (design §6.1, §6.5).
 *
 * Staging contains ONLY the selected files, written from `git cat-file blob`
 * bytes at the pinned commit. After writing, the tree is walked and any symbolic
 * link / junction (reported by lstat on Windows) fails the job. Results are
 * validated against the fixed schema and every citation is re-read from the
 * staged bytes the supervisor wrote — never taken from harness output.
 */
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import {
  answerWithCitationsSchema, sha256Hex, type WorkerCitationRecord,
} from '../../../shared/worker-contracts';

export function stageFiles(input: { repoRoot: string; commit: string; files: readonly { path: string }[]; stagingDir: string }): void {
  mkdirSync(input.stagingDir, { recursive: true });
  if (readdirSync(input.stagingDir).length > 0) throw new Error('staging_not_empty');
  for (const f of input.files) {
    const bytes = execFileSync('git', ['cat-file', 'blob', `${input.commit}:${f.path}`], { cwd: input.repoRoot, maxBuffer: 1024 * 1024 });
    const dest = join(input.stagingDir, ...f.path.split('/'));
    const rel = relative(input.stagingDir, dest);
    if (rel.startsWith('..') || rel.includes(`..${sep}`)) throw new Error('staging_escape');
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, bytes, { flag: 'wx' });
  }
  assertNoLinks(input.stagingDir);
}

/** Fails if any entry under root is a symbolic link or junction. */
export function assertNoLinks(root: string): void {
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) throw new Error('staging_reparse_point');
      if (st.isDirectory()) stack.push(p);
    }
  }
}

export function removeStaging(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

export type HarnessOutcome =
  | { ok: true; answer: unknown; citations: WorkerCitationRecord[]; costTelemetryUsd: number }
  | { ok: false; failureClass: 'schema_invalid' | 'citation_mismatch' | 'auth_required' | 'harness_unavailable'; detail: string };

const MAX_EXCERPT = 2000;

/** Validates `claude -p --output-format json` stdout and re-reads each citation from staging. */
export function validateHarnessOutput(stdout: string, stagingDir: string, stagedPaths: ReadonlySet<string>): HarnessOutcome {
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(stdout.trim()) as Record<string, unknown>; } catch { return { ok: false, failureClass: 'schema_invalid', detail: 'output_not_json' }; }
  if (parsed.type !== 'result') return { ok: false, failureClass: 'schema_invalid', detail: 'output_not_result' };
  if (parsed.is_error === true) {
    const result = String(parsed.result ?? '');
    return /not logged in|login|authenticat/i.test(result)
      ? { ok: false, failureClass: 'auth_required', detail: 'harness_reported_auth_error' }
      : { ok: false, failureClass: 'harness_unavailable', detail: 'harness_reported_error' };
  }
  const answer = answerWithCitationsSchema.safeParse(parsed.structured_output);
  if (!answer.success) return { ok: false, failureClass: 'schema_invalid', detail: `structured_output_invalid:${answer.error.issues[0]?.path.join('.') ?? 'root'}` };

  const citations: WorkerCitationRecord[] = [];
  for (const c of answer.data.citations) {
    if (!stagedPaths.has(c.path)) return { ok: false, failureClass: 'citation_mismatch', detail: 'citation_path_not_staged' };
    const text = readFileSync(join(stagingDir, ...c.path.split('/')), 'utf8');
    const lines = text.split(/\r?\n/);
    if (c.endLine > lines.length) return { ok: false, failureClass: 'citation_mismatch', detail: 'citation_beyond_file' };
    const excerpt = lines.slice(c.startLine - 1, c.endLine).join('\n');
    if (excerpt.length > MAX_EXCERPT) return { ok: false, failureClass: 'citation_mismatch', detail: 'citation_excerpt_too_long' };
    citations.push({ path: c.path, startLine: c.startLine, endLine: c.endLine, excerpt, excerptSha256: sha256Hex(Buffer.from(excerpt, 'utf8')) });
  }
  const cost = typeof parsed.total_cost_usd === 'number' && Number.isFinite(parsed.total_cost_usd) ? parsed.total_cost_usd : 0;
  return { ok: true, answer: answer.data, citations, costTelemetryUsd: Math.max(0, Math.min(cost, 1000)) };
}
