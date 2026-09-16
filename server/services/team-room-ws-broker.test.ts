import assert from "node:assert/strict";
import test from "node:test";
import {
  initializeTeamRoomWS,
  isLucaOnlineInRoom,
  registerLucaPresenceStateReader,
} from "./team-room-ws-broker";

const connectedInRoom = {
  connected: true,
  currentRoomId: "room-late",
  connectedAt: "2026-09-06T00:00:00.000Z",
  reconnectAttempts: 0,
  socketId: "luca-socket",
};

test("late browser join replays Luca online when presence is connected in that room", () => {
  let connectionHandler: ((socket: any) => void) | undefined;
  const namespace = {
    use: () => undefined,
    on: (event: string, handler: (socket: any) => void) => {
      if (event === "connection") connectionHandler = handler;
    },
    to: () => ({ emit: () => undefined }),
  };
  initializeTeamRoomWS({ of: () => namespace } as any);

  registerLucaPresenceStateReader(() => connectedInRoom);
  const emitted: unknown[] = [];
  const handlers: Record<string, (value: string) => void> = {};
  const socket = {
    id: "browser",
    data: {},
    on: (event: string, handler: (value: string) => void) => { handlers[event] = handler; },
    join: () => undefined,
    emit: (event: string, value: unknown) => { if (event === "luca_presence") emitted.push(value); },
  };
  connectionHandler!(socket);
  handlers.join_room("room-late");

  assert.deepEqual(emitted, [{
    online: true,
    connectedAt: connectedInRoom.connectedAt,
    socketId: connectedInRoom.socketId,
  }]);
});

test("late browser join reports Luca offline when the presence connection is disconnected", () => {
  assert.equal(
    isLucaOnlineInRoom("room-late", { ...connectedInRoom, connected: false }),
    false,
  );
});

test("late browser join reports Luca offline for a different room", () => {
  assert.equal(isLucaOnlineInRoom("another-room", connectedInRoom), false);
});

test("presence transitions follow the current connection and room state", () => {
  assert.equal(isLucaOnlineInRoom("room-late", connectedInRoom), true);
  assert.equal(
    isLucaOnlineInRoom("room-late", { ...connectedInRoom, connected: false }),
    false,
  );
  assert.equal(
    isLucaOnlineInRoom("room-late", { ...connectedInRoom, currentRoomId: "another-room" }),
    false,
  );
  assert.equal(
    isLucaOnlineInRoom("another-room", { ...connectedInRoom, currentRoomId: "another-room" }),
    true,
  );
});