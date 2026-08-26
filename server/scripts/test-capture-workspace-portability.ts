/**
 * Hermetic regression coverage for the canonical capture workspace boundary.
 *
 * It proves that a configured local workspace is accepted, a malformed explicit
 * root fails closed, and Claude Code capture writes only to an isolated stream.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { appendCanonicalConversationExchange } from '../services/canonical-conversation-capture';
import { parseChatCaptureFromOffset } from '../services/transcript-parser';
import {
  ensureCaptureWorkspaceWritable,
  inspectCaptureWorkspace,
  resolveWorkspaceRoot,
} from '../services/workspace-root';

function fail(message: string): never {
  throw new Error(`[capture-workspace-portability] ${message}`);
}

function makeProjectRoot(parent: string, name: string): string {
  const root = join(parent, name);
  mkdirSync(join(root, 'server'), { recursive: true });
  mkdirSync(join(root, 'shared'), { recursive: true });
  writeFileSync(join(root, 'package.json'), '{}');
  writeFileSync(join(root, 'drizzle.config.ts'), 'export default {};');
  writeFileSync(join(root, 'shared', 'schema.ts'), 'export {};');
  return root;
}

const temp = mkdtempSync(join(tmpdir(), 'holahola-capture-workspace-'));
try {
  const configuredRoot = makeProjectRoot(temp, 'configured-root');
  const configured = resolveWorkspaceRoot({
    env: { HOLAHOLA_WORKSPACE_ROOT: configuredRoot },
    cwd: join(temp, 'not-the-root'),
  });
  if (configured.root !== configuredRoot || configured.source !== 'configured') {
    fail('configured workspace root was not authoritative');
  }
  ensureCaptureWorkspaceWritable(configured);
  const inspection = inspectCaptureWorkspace(configured);
  if (!inspection.localDirectoryPresent || !inspection.localDirectoryWritable) {
    fail('configured workspace .local directory was not made writable');
  }

  const capturePath = join(configuredRoot, '.local', 'isolated-claude-code.capture');
  appendCanonicalConversationExchange({
    source: 'claude-code',
    userText: 'Isolated Claude Code user turn',
    assistantText: 'Isolated Claude Code assistant turn',
    turnId: 'workspace-portability-claude-001',
    capturePath,
    ingressLockPath: join(configuredRoot, '.local', 'isolated-ingress.lock'),
  });
  const parsed = parseChatCaptureFromOffset(capturePath, 0);
  if (
    parsed.turns.length !== 2 ||
    parsed.turns[0]?.speaker !== 'DAVID' ||
    parsed.turns[1]?.speaker !== 'CLAUDE_CODE' ||
    parsed.turns.some(turn => turn.source !== 'claude-code')
  ) {
    fail('isolated Claude Code exchange was not written with the expected source topology');
  }

  const fallbackRoot = makeProjectRoot(temp, 'cwd-root');
  const fallback = resolveWorkspaceRoot({
    env: {},
    cwd: fallbackRoot,
  });
  if (fallback.root !== fallbackRoot || fallback.source !== 'current-directory') {
    fail('validated current-directory fallback was not selected');
  }

  const invalidRoot = join(temp, 'not-a-project');
  mkdirSync(invalidRoot);
  try {
    resolveWorkspaceRoot({
      env: { HOLAHOLA_WORKSPACE_ROOT: invalidRoot },
      cwd: configuredRoot,
    });
    fail('invalid explicit root silently fell back to current directory');
  } catch (error: any) {
    if (!String(error?.message ?? error).includes('not a HolaHola project root')) throw error;
  }
  if (existsSync(join(invalidRoot, '.local', '.chat_capture'))) {
    fail('invalid explicit root received a capture file');
  }

  console.log('PASS: canonical capture resolves only validated project roots and writes Claude Code fixtures to isolated streams.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}