import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COORDINATION_LEGACY_CAPABILITIES_BY_ACTOR,
  requireFounderOrCoordinationCapability,
  resolveCoordinationActor,
  resolveCoordinationCapability,
} from './coordination-auth';

const token = (label: string) => `${label}-`.repeat(8);
const environment = {
  COORDINATION_LUCA_HOLAHOLA_TOKEN: token('hola'),
  COORDINATION_LUCA_REPLIT_TOKEN: token('replit'),
  COORDINATION_LUCA_CLAUDE_CODE_TOKEN: token('claude'),
  COORDINATION_LUCA_GEMINI_TOKEN: token('gemini'),
  COORDINATION_ALDEN_TOKEN: token('alden'),
  COORDINATION_DANIELA_TOKEN: token('daniela'),
  COORDINATION_DAVID_TOKEN: token('david'),
};
const lucaActors = ['luca-replit', 'luca-claude-code', 'luca-gemini', 'luca-holahola'] as const;
const tokenByLucaActor = {
  'luca-replit': environment.COORDINATION_LUCA_REPLIT_TOKEN,
  'luca-claude-code': environment.COORDINATION_LUCA_CLAUDE_CODE_TOKEN,
  'luca-gemini': environment.COORDINATION_LUCA_GEMINI_TOKEN,
  'luca-holahola': environment.COORDINATION_LUCA_HOLAHOLA_TOKEN,
} as const;

test('every enumerated fixed Luca credential receives observation:read', async () => {
  for (const actor of lucaActors) {
    assert.ok(COORDINATION_LEGACY_CAPABILITIES_BY_ACTOR[actor].includes('observation:read'));
    const result = await resolveCoordinationCapability(
      tokenByLucaActor[actor],
      'observation:read',
      lucaActors,
      undefined,
      environment,
    );
    assert.equal(result.ok, true, `${actor} should resolve`);
    if (result.ok) assert.equal(result.actor, actor);
  }
});

test('fixed non-Luca actors cannot read Luca observation', async () => {
  for (const actor of ['alden', 'daniela', 'david'] as const) {
    assert.equal(COORDINATION_LEGACY_CAPABILITIES_BY_ACTOR[actor].includes('observation:read'), false);
    const result = await resolveCoordinationCapability(
      environment[`COORDINATION_${actor.toUpperCase()}_TOKEN` as keyof typeof environment],
      'observation:read',
      lucaActors,
      undefined,
      environment,
    );
    assert.deepEqual(result, {
      ok: false,
      status: 403,
      error: 'Coordination actor is not authorized for this endpoint',
    });
  }
});

test('actor names cannot self-authorize by using a luca prefix', () => {
  assert.deepEqual(Object.keys(COORDINATION_LEGACY_CAPABILITIES_BY_ACTOR).sort(), [
    'alden',
    'coordination-system',
    'daniela',
    'david',
    'luca-claude-code',
    'luca-gemini',
    'luca-holahola',
    'luca-replit',
  ].sort());
});

test('luca-gemini recognizes the Gemini Code token alias', () => {
  const aliasToken = token('gemini-code');
  const aliasOnly = {
    ...environment,
    COORDINATION_LUCA_GEMINI_TOKEN: undefined,
    COORDINATION_LUCA_GEMINI_CODE_TOKEN: aliasToken,
  };
  assert.deepEqual(resolveCoordinationActor(aliasToken, undefined, aliasOnly), {
    ok: true,
    actor: 'luca-gemini',
  });
});

test('matching luca-gemini legacy and Gemini Code aliases converge', () => {
  const sharedToken = token('gemini-shared');
  const matchingAliases = {
    ...environment,
    COORDINATION_LUCA_GEMINI_TOKEN: sharedToken,
    COORDINATION_LUCA_GEMINI_CODE_TOKEN: sharedToken,
  };
  assert.deepEqual(resolveCoordinationActor(sharedToken, undefined, matchingAliases), {
    ok: true,
    actor: 'luca-gemini',
  });
});

test('conflicting luca-gemini token aliases fail closed', () => {
  const legacyToken = token('gemini-legacy');
  const codeToken = token('gemini-code');
  const conflictingAliases = {
    ...environment,
    COORDINATION_LUCA_GEMINI_TOKEN: legacyToken,
    COORDINATION_LUCA_GEMINI_CODE_TOKEN: codeToken,
  };
  for (const supplied of [legacyToken, codeToken]) {
    assert.deepEqual(resolveCoordinationActor(supplied, undefined, conflictingAliases), {
      ok: false,
      status: 503,
      error: 'Coordination authentication has conflicting luca-gemini token aliases',
    });
  }
});

test('Gemini Code alias preserves duplicate-token ambiguity protection', () => {
  const duplicate = token('shared-luca');
  const ambiguous = {
    ...environment,
    COORDINATION_LUCA_GEMINI_TOKEN: undefined,
    COORDINATION_LUCA_GEMINI_CODE_TOKEN: duplicate,
    COORDINATION_LUCA_REPLIT_TOKEN: duplicate,
  };
  assert.deepEqual(resolveCoordinationActor(duplicate, undefined, ambiguous), {
    ok: false,
    status: 503,
    error: 'Coordination authentication has ambiguous token bindings',
  });
});

test('founder fallback runs only when no coordination credential is presented', async () => {
  const previous = process.env.COORDINATION_LUCA_REPLIT_TOKEN;
  process.env.COORDINATION_LUCA_REPLIT_TOKEN = environment.COORDINATION_LUCA_REPLIT_TOKEN;
  try {
    let founderCalls = 0;
    let nextCalls = 0;
    let statusCode = 200;
    let responseBody: unknown;
    const founder = (_req: any, _res: any, next: () => void) => {
      founderCalls++;
      next();
    };
    const middleware = requireFounderOrCoordinationCapability(founder, 'observation:read', lucaActors);
    const makeResponse = () => ({
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        responseBody = body;
        return this;
      },
    });

    await middleware(
      { headers: {}, ip: '127.0.0.1', socket: {} } as any,
      makeResponse() as any,
      () => { nextCalls++; },
    );
    assert.equal(founderCalls, 1);
    assert.equal(nextCalls, 1);

    founderCalls = 0;
    nextCalls = 0;
    statusCode = 200;
    await middleware(
      {
        headers: { 'x-coordination-token': 'invalid-presented-token-that-must-not-fall-through' },
        ip: '127.0.0.1',
        socket: {},
      } as any,
      makeResponse() as any,
      () => { nextCalls++; },
    );
    assert.equal(founderCalls, 0);
    assert.equal(nextCalls, 0);
    assert.equal(statusCode, 401);
    assert.deepEqual(responseBody, { error: 'Invalid coordination token' });
  } finally {
    if (previous === undefined) delete process.env.COORDINATION_LUCA_REPLIT_TOKEN;
    else process.env.COORDINATION_LUCA_REPLIT_TOKEN = previous;
  }
});