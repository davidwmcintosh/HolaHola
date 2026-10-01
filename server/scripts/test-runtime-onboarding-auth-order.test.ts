import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import passport from 'passport';
import test from 'node:test';
import * as ts from 'typescript';
import { registerRuntimeOnboardingRoutes } from '../routes/runtime-onboarding-routes';

const ROUTES_SOURCE_URL = new URL('../routes.ts', import.meta.url);

function registerRoutesStatements(sourceText: string): {
  sourceFile: ts.SourceFile;
  statements: readonly ts.Statement[];
} {
  const sourceFile = ts.createSourceFile(
    'server/routes.ts',
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  assert.equal(sourceFile.parseDiagnostics.length, 0, 'routes.ts must parse as TypeScript');

  const declaration = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === 'registerRoutes',
  );
  assert.ok(declaration?.body, 'routes.ts must declare registerRoutes with a function body');
  assert.ok(
    declaration.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword),
    'registerRoutes must remain async',
  );
  return { sourceFile, statements: declaration.body.statements };
}

function isAwaitedCall(statement: ts.Statement, calleeName: string): boolean {
  if (!ts.isExpressionStatement(statement) || !ts.isAwaitExpression(statement.expression)) return false;
  const call = statement.expression.expression;
  return ts.isCallExpression(call)
    && ts.isIdentifier(call.expression)
    && call.expression.text === calleeName;
}

function isCallStatement(statement: ts.Statement, calleeName: string): boolean {
  if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) return false;
  return ts.isIdentifier(statement.expression.expression)
    && statement.expression.expression.text === calleeName;
}

function assertRuntimeOnboardingAuthOrder(sourceText: string): void {
  const { statements } = registerRoutesStatements(sourceText);
  const setupAuthIndex = statements.findIndex((statement) => isAwaitedCall(statement, 'setupAuth'));
  const setupGoogleAuthIndex = statements.findIndex((statement) =>
    isAwaitedCall(statement, 'setupGoogleAuth'));
  const onboardingIndex = statements.findIndex((statement) =>
    isCallStatement(statement, 'registerRuntimeOnboardingRoutes'));

  assert.ok(setupAuthIndex >= 0, 'registerRoutes must directly await setupAuth');
  assert.ok(setupGoogleAuthIndex >= 0, 'registerRoutes must directly await setupGoogleAuth');
  assert.ok(onboardingIndex >= 0, 'registerRoutes must register runtime onboarding routes');
  assert.ok(
    setupAuthIndex < onboardingIndex,
    'registerRuntimeOnboardingRoutes must follow awaited setupAuth',
  );
  assert.ok(
    setupGoogleAuthIndex < onboardingIndex,
    'registerRuntimeOnboardingRoutes must follow awaited setupGoogleAuth',
  );
}

test('registerRoutes awaits both auth setups before registering runtime onboarding routes', () => {
  const routesSource = readFileSync(ROUTES_SOURCE_URL, 'utf8');
  assertRuntimeOnboardingAuthOrder(routesSource);
});

test('the AST order guard rejects comments and a hoisted onboarding registration', () => {
  const routesSource = readFileSync(ROUTES_SOURCE_URL, 'utf8');
  const { sourceFile, statements } = registerRoutesStatements(routesSource);
  const setupAuth = statements.find((statement) => isAwaitedCall(statement, 'setupAuth'));
  const setupGoogleAuth = statements.find((statement) => isAwaitedCall(statement, 'setupGoogleAuth'));
  const onboardingRegistration = statements.find((statement) =>
    isCallStatement(statement, 'registerRuntimeOnboardingRoutes'));
  assert.ok(setupAuth && setupGoogleAuth && onboardingRegistration);

  const hoistedMutation = `async function registerRoutes() {
${[
    onboardingRegistration.getText(sourceFile),
    setupAuth.getText(sourceFile),
    setupGoogleAuth.getText(sourceFile),
  ].join('\n')}
}`;
  assert.throws(
    () => assertRuntimeOnboardingAuthOrder(hoistedMutation),
    /registerRuntimeOnboardingRoutes must follow awaited setupAuth/,
  );

  const commentOnlyCalls = `async function registerRoutes() {
  // await setupAuth(app);
  // await setupGoogleAuth(app);
  // registerRuntimeOnboardingRoutes(app);
}`;
  assert.throws(
    () => assertRuntimeOnboardingAuthOrder(commentOnlyCalls),
    /registerRoutes must directly await setupAuth/,
  );
});

test('anonymous admin onboarding request is promptly rejected with the default founder middleware', async () => {
  const app = express();
  app.use(passport.initialize());

  let adminViewCalls = 0;
  registerRuntimeOnboardingRoutes(app, {
    services: {
      getRuntimeOnboardingAdminView: async () => {
        adminViewCalls += 1;
        throw new Error('admin view must not run for an anonymous request');
      },
    },
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const address = server.address() as AddressInfo;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1_500);
    let response: Response;
    try {
      response = await fetch(
        `http://127.0.0.1:${address.port}/api/coordination/onboarding/admin`,
        { headers: { connection: 'close' }, signal: controller.signal },
      );
    } catch (error) {
      assert.fail(`anonymous request did not finish promptly: ${String(error)}`);
    } finally {
      clearTimeout(timeout);
    }

    assert.equal(response.status, 401);
    assert.equal(adminViewCalls, 0, 'admin view service must not run before founder authorization');
  } finally {
    const closed = new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
    await closed;
  }
});