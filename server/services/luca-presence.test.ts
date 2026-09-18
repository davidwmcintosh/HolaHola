import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import type { TeamRoomJoinAck } from "./team-room-ws-broker";
import {
  __lucaPresenceTest,
  getLucaPresenceState,
  isValidLucaCredential,
  joinRoom,
  syncWithActiveRoom,
} from "./luca-presence";

type Ack = (result: TeamRoomJoinAck) => void;

function fakeSocket(
  onJoin: (roomId: string, acknowledge: Ack, requestId: string) => void = (roomId, acknowledge, requestId) => {
    acknowledge({ ok: true, roomId, requestId });
  },
) {
  const emitted: Array<{ event: string; roomId?: string }> = [];
  let disconnects = 0;
  let connects = 0;
  const socket = {
    id: "fake-luca",
    connected: true,
    emit(event: string, ...args: unknown[]) {
      const request = args[0] as string | { roomId?: string; requestId?: string };
      const roomId = typeof request === "string" ? request : request?.roomId;
      emitted.push({ event, roomId });
      if (event === "join_room") {
        onJoin(roomId!, args[1] as Ack, typeof request === "string" ? "" : request.requestId!);
      }
      return socket;
    },
    disconnect() {
      disconnects += 1;
      socket.connected = false;
      return socket;
    },
    connect() {
      connects += 1;
      socket.connected = true;
      return socket;
    },
  };
  return {
    socket: socket as any,
    emitted,
    disconnectCount: () => disconnects,
    connectCount: () => connects,
  };
}

afterEach(() => {
  __lucaPresenceTest.reset();
});

test("Luca credential validation matches the dedicated broker token boundary", () => {
  assert.equal(isValidLucaCredential(null), false);
  assert.equal(isValidLucaCredential("short"), false);
  assert.equal(isValidLucaCredential("a".repeat(32)), true);
  assert.equal(isValidLucaCredential(`  ${"a".repeat(32)}  `), true);
});

test("joins an existing authoritative room only after broker acknowledgement", async () => {
  let acknowledgeJoin: Ack | undefined;
  let requestId = "";
  const fake = fakeSocket((_roomId, acknowledge, joinRequestId) => {
    acknowledgeJoin = acknowledge;
    requestId = joinRequestId;
  });
  __lucaPresenceTest.setSocket(fake.socket);
  __lucaPresenceTest.setActiveRoomLookup(async () => "room-existing");

  const syncing = syncWithActiveRoom();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(getLucaPresenceState().currentRoomId, null);

  acknowledgeJoin!({ ok: true, roomId: "room-existing", requestId });
  await syncing;
  assert.equal(getLucaPresenceState().currentRoomId, "room-existing");
});

test("no room at connect can bind to a room created later", async () => {
  const fake = fakeSocket();
  let activeRoom: string | null = null;
  __lucaPresenceTest.setSocket(fake.socket);
  __lucaPresenceTest.setActiveRoomLookup(async () => activeRoom);

  await syncWithActiveRoom();
  assert.equal(getLucaPresenceState().currentRoomId, null);

  activeRoom = "room-later";
  await syncWithActiveRoom();
  assert.equal(getLucaPresenceState().currentRoomId, "room-later");
  assert.ok(fake.emitted.some(event => event.event === "join_room" && event.roomId === "room-later"));
});

test("a stale database lookup cannot overwrite a newer active room", async () => {
  let resolveOld!: (roomId: string | null) => void;
  const oldLookup = new Promise<string | null>(resolve => { resolveOld = resolve; });
  const fake = fakeSocket();
  __lucaPresenceTest.setSocket(fake.socket);
  __lucaPresenceTest.setActiveRoomLookup(() => oldLookup);
  const oldSync = syncWithActiveRoom();

  __lucaPresenceTest.setActiveRoomLookup(async () => "room-new");
  await syncWithActiveRoom();
  resolveOld("room-old");
  await oldSync;

  assert.equal(getLucaPresenceState().currentRoomId, "room-new");
  assert.equal(
    fake.emitted.some(event => event.event === "join_room" && event.roomId === "room-old"),
    false,
  );
});

test("a delayed stale acknowledgement is removed after a newer room wins", async () => {
  let oldAcknowledge!: Ack;
  let oldRequestId = "";
  const fake = fakeSocket((roomId, acknowledge, requestId) => {
    if (roomId === "room-old") oldAcknowledge = acknowledge;
    if (roomId === "room-old") oldRequestId = requestId;
    else acknowledge({ ok: true, roomId, requestId });
  });
  let activeRoom = "room-old";
  __lucaPresenceTest.setSocket(fake.socket);
  __lucaPresenceTest.setActiveRoomLookup(async () => activeRoom);
  const oldSync = syncWithActiveRoom();
  await new Promise(resolve => setImmediate(resolve));

  activeRoom = "room-new";
  await syncWithActiveRoom();
  oldAcknowledge({ ok: true, roomId: "room-old", requestId: oldRequestId });
  await oldSync;

  assert.equal(getLucaPresenceState().currentRoomId, "room-new");
  assert.ok(fake.emitted.some(event => event.event === "leave_room" && event.roomId === "room-old"));
});

test("a rejected join never marks Luca online in that room", async () => {
  const fake = fakeSocket((roomId, acknowledge, requestId) => {
    acknowledge({ ok: false, roomId, requestId, error: "room-not-found" });
  });
  __lucaPresenceTest.setSocket(fake.socket);
  __lucaPresenceTest.setActiveRoomLookup(async () => "room-missing");

  await syncWithActiveRoom();
  assert.equal(getLucaPresenceState().currentRoomId, null);
});

test("explicit room joins also wait for broker acknowledgement", async () => {
  const fake = fakeSocket();
  __lucaPresenceTest.setSocket(fake.socket);
  assert.equal(await joinRoom("room-explicit"), true);
  assert.equal(getLucaPresenceState().currentRoomId, "room-explicit");
});

test("an unacknowledged join reconnects before retrying", async () => {
  const fake = fakeSocket(() => undefined);
  __lucaPresenceTest.setSocket(fake.socket);
  __lucaPresenceTest.setActiveRoomLookup(async () => "room-timeout");
  __lucaPresenceTest.setJoinAckTimeoutMs(5);

  await syncWithActiveRoom();
  assert.equal(getLucaPresenceState().currentRoomId, null);
  assert.equal(fake.disconnectCount(), 1);
  assert.equal(fake.connectCount(), 1);
});

test("a stale timed-out join cannot reconnect over a newer binding", async () => {
  const fake = fakeSocket((roomId, acknowledge, requestId) => {
    if (roomId === "room-new") acknowledge({ ok: true, roomId, requestId });
  });
  let activeRoom = "room-old";
  __lucaPresenceTest.setSocket(fake.socket);
  __lucaPresenceTest.setActiveRoomLookup(async () => activeRoom);
  __lucaPresenceTest.setJoinAckTimeoutMs(10);
  const staleSync = syncWithActiveRoom();
  await new Promise(resolve => setImmediate(resolve));

  activeRoom = "room-new";
  await syncWithActiveRoom();
  await staleSync;

  assert.equal(getLucaPresenceState().currentRoomId, "room-new");
  assert.equal(fake.disconnectCount(), 0);
  assert.equal(fake.connectCount(), 0);
});