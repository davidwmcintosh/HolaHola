#!/usr/bin/env npx tsx
/**
 * Required committed-source paths must be tracked AND not ignored.
 * Read consumer declarations without importing the DB-backed runtime service.
 * --self-check uses disposable Git indexes, never the workspace index.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function requiredPaths(): string[] {
  const servicePath = 'server/services/coordination-v2-runtime-bootstrap-service.ts';
  const source = ts.createSourceFile(servicePath, readFileSync(join(root, servicePath), 'utf8'),
    ts.ScriptTarget.Latest, true);

  function declaration(scope: ts.Node, name: string): ts.Expression {
    const matches: ts.Expression[] = [];
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
        && node.name.text === name && node.initializer) matches.push(node.initializer);
      ts.forEachChild(node, visit);
    }
    visit(scope);
    assert.equal(matches.length, 1, `Expected exactly one consumer declaration: ${name}`);
    return matches[0];
  }

  function strings(expression: ts.Expression, bindings: Record<string, string[]> = {}): string[] {
    if (ts.isAsExpression(expression) || ts.isParenthesizedExpression(expression)
      || ts.isSatisfiesExpression(expression)) return strings(expression.expression, bindings);
    assert.ok(ts.isArrayLiteralExpression(expression), 'Required source list must be a static array');
    return expression.elements.flatMap(element => {
      if (ts.isStringLiteral(element)) return [element.text];
      if (ts.isSpreadElement(element) && ts.isIdentifier(element.expression)) {
        const values = bindings[element.expression.text];
        assert.ok(values, `Unknown source-list spread: ${element.expression.text}`);
        return values;
      }
      throw new Error(`Unsupported required source-list element: ${element.getText(source)}`);
    });
  }

  const members = strings(declaration(source, 'RUNTIME_SOURCE_MEMBER_PATHS'));
  const provenance = source.statements.find(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'deriveCoordinationV2RuntimeProvenance');
  assert.ok(provenance, 'Runtime provenance consumer not found');
  const snapshot = strings(declaration(provenance, 'fixedPaths'), {
    RUNTIME_SOURCE_MEMBER_PATHS: members,
  });

  // The Windows consumer also has two independent fixed source allowlists.
  const launcher = readFileSync(join(root, 'scripts/hola-coordinator.ps1'), 'utf8');
  function launcherPaths(pattern: RegExp, name: string): string[] {
    const match = launcher.match(pattern);
    assert.ok(match, `Windows source-list declaration not found: ${name}`);
    const result = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(value => value[1]);
    assert.ok(result.length, `Empty Windows source-list declaration: ${name}`);
    return result;
  }
  const powershell = launcherPaths(/\$ApprovedSourceMemberPaths\s*=\s*@\(([\s\S]*?)\)/, 'ApprovedSourceMemberPaths');
  const verifier = launcherPaths(/const\s+approvedSources\s*=\s*new Set\(\[([\s\S]*?)\]\)/, 'approvedSources');
  const paths = [...new Set([...members, ...snapshot, ...powershell, ...verifier])];
  assert.ok(paths.length, 'Required runtime source inventory is empty');
  for (const path of paths) {
    assert.ok(!path.startsWith('/') && !path.split('/').includes('..') && !path.includes('\\'),
      `Required source must be repository-relative: ${path}`);
  }
  return paths;
}

function git(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.error || result.signal || result.status === null) {
    throw new Error(`Cannot run git ${args[0]}: ${result.error?.message ?? result.signal}`);
  }
  return result;
}

function check(cwd: string, paths: string[]): string[] {
  const failures: string[] = [];
  for (const path of paths) {
    // --no-index is essential: ordinary check-ignore hides ignored TRACKED files.
    const ignored = git(cwd, ['check-ignore', '--no-index', '--', path]);
    if (ignored.status === 0) failures.push(`${path}: ignored by Git; add a narrow .gitignore exception`);
    else if (ignored.status !== 1) throw new Error(`git check-ignore failed: ${ignored.stderr.trim()}`);

    const tracked = git(cwd, ['ls-files', '--error-unmatch', '--', path]);
    if (tracked.status === 1) failures.push(`${path}: not tracked; add the required source file to Git`);
    else if (tracked.status !== 0) throw new Error(`git ls-files failed: ${tracked.stderr.trim()}`);
  }
  return failures;
}

function selfCheck(paths: string[]) {
  const fixture = mkdtempSync(join(tmpdir(), 'required-runtime-sources-'));
  try {
    assert.equal(git(fixture, ['init', '--quiet']).status, 0);
    for (const path of paths) {
      mkdirSync(dirname(join(fixture, path)), { recursive: true });
      writeFileSync(join(fixture, path), 'synthetic source fixture\n');
    }
    writeFileSync(join(fixture, '.gitignore'), '');
    assert.equal(git(fixture, ['add', '--', ...paths]).status, 0);
    assert.deepEqual(check(fixture, paths), []);

    // Every inventory member is independently tested, including the lockfile.
    for (const path of paths) {
      writeFileSync(join(fixture, '.gitignore'), `/${path}\n`);
      assert.deepEqual(check(fixture, paths), [
        `${path}: ignored by Git; add a narrow .gitignore exception`,
      ]);
      assert.equal(git(fixture, ['rm', '--cached', '--quiet', '--', path]).status, 0);
      assert.deepEqual(check(fixture, paths), [
        `${path}: ignored by Git; add a narrow .gitignore exception`,
        `${path}: not tracked; add the required source file to Git`,
      ]);
      writeFileSync(join(fixture, '.gitignore'), '');
      assert.deepEqual(check(fixture, paths), [
        `${path}: not tracked; add the required source file to Git`,
      ]);
      assert.equal(git(fixture, ['add', '--', path]).status, 0);
    }
    // Reproduce the original blanket PEM rule and prove the narrow exception.
    writeFileSync(join(fixture, '.gitignore'), '*.pem\n');
    assert.ok(check(fixture, paths).some(failure => failure.includes('signing-public.pem: ignored')));
    writeFileSync(join(fixture, '.gitignore'), '*.pem\n!scripts/coordination-v2-server-signing-public.pem\n');
    assert.deepEqual(check(fixture, paths), []);
    console.log(`Required runtime sources self-check passed (${paths.length} paths).`);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

try {
  const paths = requiredPaths();
  if (process.argv.includes('--self-check')) selfCheck(paths);
  else {
    const failures = check(root, paths);
    if (failures.length) throw new Error(`Required runtime sources are unavailable:\n${failures.join('\n')}`);
    console.log(`Required runtime sources passed: ${paths.join(', ')}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}