import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import signature from "cookie-signature";
import {
  configureTeamRoomWSAuth,
  initializeTeamRoomWS,
  isLucaOnlineInRoom,
  registerLucaPresenceStateReader,
} from "./team-room-ws-broker";

const SECRET = "hermetic-team-room-session-secret";
process.env.SESSION_SECRET = SECRET;
const TOKEN = "a".repeat(40);
const founder = { id: "49847136", role: "admin" };
const student = { id: "student", role: "student" };
const connectedInRoom = {
  connected: true,
  currentRoomId: "room-late",
  connectedAt: "2026-09-06T00:00:00.000Z",
  reconnectAttempts: 0,
  socketId: "luca-socket",
};

function cookieFor(sessionId: string): string {
  return `connect.sid=s:${signature.sign(sessionId, SECRET)}`;
}

function setupNamespace() {
  let middleware: ((socket: any, next: (error?: Error) => void) => Promise<void>) | undefined;
  let connection: ((socket: any) => void) | undefined;
  const namespace = {
    use: (handler: typeof middleware) => { middleware = handler; },
    on: (event: string, handler: (socket: any) => void) => {
      if (event === "connection") connection = handler;
    },
    to: () => ({ emit: () => undefined }),
  };
  initializeTeamRoomWS({ of: () => namespace } as any);
  return {
    authenticate: async (socket: any) => {
      let error: Error | undefined;
      await middleware!(socket, (nextError) => { error = nextError; });
      return error;
    },
    connect: (socket: any) => connection!(socket),
  };
}

function socket(cookie?: string, auth: Record<string, unknown> = {}) {
  return {
    id: "test-socket",
    data: {},
    handshake: { auth },
    request: { headers: cookie ? { cookie } : {} },
    on: () => undefined,
    emit: () => undefined,
    join: () => undefined,
    leave: () => undefined,
  };
}

afterEach(() => {
  configureTeamRoomWSAuth({});
  registerLucaPresenceStateReader(() => ({
    connected: false,
    currentRoomId: null,
    connectedAt: null,
    socketId: null,
  }));
  delete process.env.COORDINATION_LUCA_REPLIT_TOKEN;
});

test("namespace middleware accepts live founder password and Passport sessions", async () => {
  const sessions = new Map([
    ["password", { sess: { userId: founder.id }, expire: new Date(Date.now() + 60_000) }],
    ["passport", { sess: { passport: { user: { claims: { sub: founder.id } } } }, expire: new Date(Date.now() + 60_000) }],
  ]);
  configureTeamRoomWSAuth({
    readSession: async (id) => sessions.get(id) ?? null,
    readUser: async (id) => id === founder.id ? founder : null,
  });
  const ws = setupNamespace();
  assert.equal(await ws.authenticate(socket(cookieFor("password"))), undefined);
  assert.equal(await ws.authenticate(socket(cookieFor("passport"))), undefined);
});

test("namespace middleware rejects missing, garbage, unsigned, expired, non-founder, replit-only, and DB-error sessions", async () => {
  configureTeamRoomWSAuth({
    readSession: async (id) => {
      if (id === "expired") return { sess: { userId: founder.id }, expire: new Date(Date.now() - 1) };
      if (id === "db-error") throw new Error("database unavailable");
      return { sess: { userId: student.id }, expire: new Date(Date.now() + 60_000) };
    },
    readUser: async (id) => id === founder.id ? founder : student,
  });
  const ws = setupNamespace();
  for (const candidate of [
    undefined,
    "garbage",
    "connect.sid=s:unsigned",
    cookieFor("expired"),
    cookieFor("student"),
    "replit:authed=true",
    cookieFor("db-error"),
  ]) {
    assert.ok(await ws.authenticate(socket(candidate)), `expected rejection for ${candidate ?? "missing"}`);
  }
});

test("agent-token branch accepts only the valid token and does not require a cookie", async () => {
  process.env.COORDINATION_LUCA_REPLIT_TOKEN = TOKEN;
  configureTeamRoomWSAuth({ readSession: async () => { throw new Error("must not read browser session"); } });
  const ws = setupNamespace();
  const valid = socket(undefined, { agentToken: TOKEN });
  assert.equal(await ws.authenticate(valid), undefined);
  assert.equal(valid.data.identity, "luca");
  assert.ok(await ws.authenticate(socket(undefined, { agentToken: "wrong-token" })));
});

test("actual async join validates rooms and replays only for an authorized late browser", async () => {
  const rooms = new Set(["room-late", "another-room"]);
  configureTeamRoomWSAuth({
    readSession: async () => ({ sess: { userId: founder.id }, expire: new Date(Date.now() + 60_000) }),
    readUser: async () => founder,
    roomExists: async (roomId) => rooms.has(roomId),
  });
  registerLucaPresenceStateReader(() => connectedInRoom);
  const ws = setupNamespace();
  const joined: string[] = [];
  const emitted: unknown[] = [];
  const browser = socket(cookieFor("founder"));
  browser.join = (room: string) => joined.push(room);
  browser.emit = (event: string, value: unknown) => { if (event === "luca_presence") emitted.push(value); };
  assert.equal(await ws.authenticate(browser), undefined);
  ws.connect(browser);
  await browser.on;
  // Recreate the connection handler's event registration with an observable socket.
  const handlers: Record<string, (room: string) => Promise<void>> = {};
  browser.on = (event: string, handler: (room: string) => Promise<void>) => { handlers[event] = handler; };
  ws.connect(browser);
  await handlers.join_room("room-late");
  await handlers.join_room("missing-room");
  await handlers.join_room("bad room");
  assert.deepEqual(joined, ["room:room-late"]);
  assert.deepEqual(emitted, [{ online: true, connectedAt: connectedInRoom.connectedAt }]);

  const wrongRoom = socket(cookieFor("founder"));
  const wrongEvents: unknown[] = [];
  wrongRoom.emit = (event: string, value: unknown) => { if (event === "luca_presence") wrongEvents.push(value); };
  wrongRoom.join = (room: string) => joined.push(room);
  assert.equal(await ws.authenticate(wrongRoom), undefined);
  ws.connect(wrongRoom);
  const wrongHandlers: Record<string, (room: string) => Promise<void>> = {};
  wrongRoom.on = (event: string, handler: (room: string) => Promise<void>) => { wrongHandlers[event] = handler; };
  ws.connect(wrongRoom);
  await wrongHandlers.join_room("another-room");
  assert.deepEqual(wrongEvents, [{ online: false, connectedAt: connectedInRoom.connectedAt }]);

  process.env.COORDINATION_LUCA_REPLIT_TOKEN = TOKEN;
  const luca = socket(undefined, { agentToken: TOKEN });
  const lucaEvents: unknown[] = [];
  luca.emit = (_event: string, value: unknown) => lucaEvents.push(value);
  assert.equal(await ws.authenticate(luca), undefined);
  ws.connect(luca);
  const lucaHandlers: Record<string, (room: string) => Promise<void>> = {};
  luca.on = (event: string, handler: (room: string) => Promise<void>) => { lucaHandlers[event] = handler; };
  ws.connect(luca);
  await lucaHandlers.join_room("room-late");
  assert.deepEqual(lucaEvents, []);
});

test("presence online predicate requires both connection and matching room", () => {
  assert.equal(isLucaOnlineInRoom("room-late", connectedInRoom), true);
  assert.equal(isLucaOnlineInRoom("room-late", { ...connectedInRoom, connected: false }), false);
  assert.equal(isLucaOnlineInRoom("another-room", connectedInRoom), false);
});