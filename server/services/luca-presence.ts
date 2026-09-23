/**
 * luca-presence.ts
 *
 * Luca's live WebSocket presence inside HolaHola's Team Room.
 *
 * Maintains a persistent server-side Socket.IO client so Luca:
 *   - Appears as "Luca" (not "Agent") in Team Room presence
 *   - Receives real-time events: messages, session state changes
 *   - Buffers nudges (messages directed @luca) for retrieval
 *   - Broadcasts luca_presence events so the browser UI shows online/offline
 *
 * Alden (Aug 6 2026): "The load-bearing piece is a database identity first, then
 * a WebSocket anchored to that identity, then presence management."
 */

import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { getSharedDb } from "../db";
import { teamRooms } from "../../shared/schema";
import { desc, eq } from "drizzle-orm";
import {
  emitToRoom,
  registerLucaPresenceStateReader,
  type TeamRoomJoinAck,
} from "./team-room-ws-broker";
import { respondToNudge } from "./luca-responder";
import { getCurrentSessionSnapshot, startLucaObserver } from "./luca-observer";
import { getAgentCredential } from "./agent-auth";

// ── Config ────────────────────────────────────────────────────────────────────

const NUDGE_BUFFER_LIMIT = 200;
const MIN_AGENT_TOKEN_LENGTH = 32;
const ROOM_SYNC_RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 30_000, 60_000] as const;
const DEFAULT_ROOM_JOIN_ACK_TIMEOUT_MS = 10_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LucaPresenceState {
  connected: boolean;
  currentRoomId: string | null;
  connectedAt: string | null; // ISO string
  reconnectAttempts: number;
  socketId: string | null;
}

export interface NudgeEntry {
  id: string;
  from: string;
  content: string;
  receivedAt: string; // ISO string
  roomId: string;
}

// ── In-memory state ───────────────────────────────────────────────────────────

let _socket: ClientSocket | null = null;
let _roomSyncTimer: ReturnType<typeof setTimeout> | null = null;
let _roomSyncRetryAttempt = 0;
let _roomSyncGeneration = 0;
let _transportRetryAttempt = 0;
let _roomJoinAckTimeoutMs = DEFAULT_ROOM_JOIN_ACK_TIMEOUT_MS;
let _confirmedRoomIds = new Set<string>();
let _state: LucaPresenceState = {
  connected: false,
  currentRoomId: null,
  connectedAt: null,
  reconnectAttempts: 0,
  socketId: null,
};

registerLucaPresenceStateReader(() => getLucaPresenceState());

// Nudge ring-buffer: messages directed @luca from the Team Room
let _nudgeBuffer: NudgeEntry[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true when this message is a nudge directed at Luca. */
function isNudgeForLuca(speaker: string, content: string): boolean {
  // Luca's own outgoing messages -- matches both the bare "Luca" label used by
  // in-process posters (luca-responder.ts, source-control-service.ts, etc.)
  // and the hat-specific "Luca [Replit]" / "Luca [Claude Code]" / etc. labels
  // the Team Room HTTP endpoint attributes per authenticated coordination actor.
  if (speaker.toLowerCase().startsWith("luca")) return false;
  const lower = content.toLowerCase();
  return (
    lower.includes("@luca") ||
    lower.startsWith("luca,") ||
    lower.startsWith("luca:") ||
    / luca[,:]/.test(lower)
  );
}

/** Fetch the most recently active room from the DB. */
async function getActiveRoomId(): Promise<string | null> {
  try {
    const db = getSharedDb();
    const rooms = await db
      .select({ id: teamRooms.id })
      .from(teamRooms)
      .where(eq(teamRooms.status, "active"))
      .orderBy(desc(teamRooms.createdAt))
      .limit(1);
    return rooms[0]?.id ?? null;
  } catch {
    return null;
  }
}

let _activeRoomLookup: () => Promise<string | null> = getActiveRoomId;

/** The broker requires the dedicated Luca token and rejects short/missing values. */
export function isValidLucaCredential(token: string | null | undefined): token is string {
  return typeof token === "string" && token.trim().length >= MIN_AGENT_TOKEN_LENGTH;
}

function clearRoomSyncTimer(): void {
  if (_roomSyncTimer) {
    clearTimeout(_roomSyncTimer);
    _roomSyncTimer = null;
  }
}

function scheduleRoomSyncRetry(reason: "no-active-room" | "transport"): void {
  if (_roomSyncTimer) return;
  const delay = ROOM_SYNC_RETRY_DELAYS_MS[_roomSyncRetryAttempt];
  if (delay === undefined) {
    console.warn(`[LucaPresence] Retry exhausted (${reason})`);
    return;
  }

  _roomSyncRetryAttempt += 1;
  console.warn(`[LucaPresence] Retry scheduled (${reason}) in ${delay}ms`);
  _roomSyncTimer = setTimeout(() => {
    _roomSyncTimer = null;
    if (reason === "transport") {
      connectLucaToTeamRoom();
    } else {
      void syncWithActiveRoom();
    }
  }, delay);
  _roomSyncTimer.unref?.();
}

async function requestConfirmedRoomJoin(
  socket: ClientSocket,
  roomId: string,
  generation: number,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn(`[LucaPresence] Room join acknowledgement timed out: ${roomId}`);
      if (generation === _roomSyncGeneration && socket === _socket) {
        // A current timed-out acknowledgement leaves membership unknowable.
        // Reconnect so Socket.IO clears all server-side rooms before retry.
        socket.disconnect();
        socket.connect();
      }
      resolve(false);
    }, _roomJoinAckTimeoutMs);

    const requestId = String(generation);
    socket.emit("join_room", { roomId, requestId }, (ack: TeamRoomJoinAck) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!ack?.ok || ack.roomId !== roomId || ack.requestId !== requestId) {
        console.warn(
          `[LucaPresence] Room join rejected: ${roomId} (${ack?.ok === false ? ack.error : "invalid-ack"})`,
        );
        resolve(false);
        return;
      }
      _confirmedRoomIds.add(roomId);
      resolve(true);
    });
  });
}

function applyConfirmedRoomBinding(socket: ClientSocket, roomId: string): void {
  const previousRoomId = _state.currentRoomId;
  for (const confirmedRoomId of _confirmedRoomIds) {
    if (confirmedRoomId !== roomId) {
      socket.emit("leave_room", confirmedRoomId);
      _confirmedRoomIds.delete(confirmedRoomId);
    }
  }
  if (previousRoomId && previousRoomId !== roomId) {
    broadcastPresence(previousRoomId, false);
  }
  _confirmedRoomIds.add(roomId);
  _state.currentRoomId = roomId;
  broadcastPresence(roomId, true);
}

function cleanUnboundConfirmedRooms(socket: ClientSocket): void {
  for (const roomId of _confirmedRoomIds) {
    if (roomId !== _state.currentRoomId) {
      socket.emit("leave_room", roomId);
      _confirmedRoomIds.delete(roomId);
    }
  }
}

/** Broadcast luca_presence to all sockets in the given room. */
function broadcastPresence(roomId: string, online: boolean) {
  emitToRoom(roomId, "luca_presence", {
    online,
    connectedAt: _state.connectedAt,
    socketId: _state.socketId,
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Current presence snapshot. Safe to serialize and return to callers. */
export function getLucaPresenceState(): LucaPresenceState {
  return { ..._state };
}

/**
 * Return nudges buffered since `cursor` (index into the buffer).
 * Cursor = 0 returns all nudges; caller should persist returned cursor
 * and pass it on the next poll to receive only new nudges.
 */
export function getLucaNudges(cursor = 0): { nudges: NudgeEntry[]; cursor: number } {
  const from = Math.max(0, cursor);
  const nudges = _nudgeBuffer.slice(from);
  return { nudges, cursor: _nudgeBuffer.length };
}

/** Clear the nudge buffer (e.g. after Luca has processed them). */
export function clearNudgeBuffer() {
  _nudgeBuffer = [];
}

/**
 * Switch Luca into a specific room (joins it and broadcasts presence there).
 * Safe to call from routes that know the room ID.
 */
export async function joinRoom(roomId: string): Promise<boolean> {
  if (!_socket?.connected) return false;
  const socket = _socket;
  const generation = ++_roomSyncGeneration;
  clearRoomSyncTimer();
  _roomSyncRetryAttempt = 0;
  const joined = await requestConfirmedRoomJoin(socket, roomId, generation);
  if (
    !joined ||
    generation !== _roomSyncGeneration ||
    socket !== _socket ||
    !socket.connected
  ) {
    cleanUnboundConfirmedRooms(socket);
    return false;
  }
  applyConfirmedRoomBinding(socket, roomId);
  console.log(`[LucaPresence] Switched to room: ${roomId}`);
  return true;
}

/**
 * Re-read the authoritative active room and bind Luca to it.
 *
 * The generation check is intentionally performed after the database read and
 * before any socket mutation: an older, slower lookup can never overwrite a
 * newer room selection.
 */
export async function syncWithActiveRoom(): Promise<void> {
  const socket = _socket;
  if (!socket?.connected) {
    scheduleRoomSyncRetry("transport");
    return;
  }

  const generation = ++_roomSyncGeneration;
  const roomId = await _activeRoomLookup();
  if (
    generation !== _roomSyncGeneration ||
    socket !== _socket ||
    !socket.connected
  ) {
    return;
  }

  if (!roomId) {
    console.log("[LucaPresence] Connected with no active room");
    scheduleRoomSyncRetry("no-active-room");
    return;
  }

  clearRoomSyncTimer();
  _roomSyncRetryAttempt = 0;
  _transportRetryAttempt = 0;
  if (_state.currentRoomId === roomId) {
    console.log(`[LucaPresence] Already joined authoritative room: ${roomId}`);
    return;
  }

  const joined = await requestConfirmedRoomJoin(socket, roomId, generation);
  if (
    generation !== _roomSyncGeneration ||
    socket !== _socket ||
    !socket.connected
  ) {
    if (joined && _state.currentRoomId && _state.currentRoomId !== roomId) {
      socket.emit("leave_room", roomId);
      _confirmedRoomIds.delete(roomId);
    }
    return;
  }
  if (!joined) {
    cleanUnboundConfirmedRooms(socket);
    scheduleRoomSyncRetry("no-active-room");
    return;
  }
  applyConfirmedRoomBinding(socket, roomId);
  console.log(`[LucaPresence] Joined authoritative room: ${roomId}`);
}

/** Gracefully disconnect Luca's presence socket. */
export function disconnectLuca(): void {
  _roomSyncGeneration += 1;
  clearRoomSyncTimer();
  _roomSyncRetryAttempt = 0;
  _transportRetryAttempt = 0;
  _confirmedRoomIds.clear();
  if (_state.currentRoomId) {
    broadcastPresence(_state.currentRoomId, false);
  }
  _socket?.disconnect();
  _socket = null;
  _state = {
    connected: false,
    currentRoomId: null,
    connectedAt: null,
    reconnectAttempts: 0,
    socketId: null,
  };
  console.log("[LucaPresence] Disconnected");
}

/**
 * Establish (or re-use) Luca's persistent WebSocket presence in the Team Room.
 *
 * Call once after server.listen() completes. Idempotent — re-entrant calls
 * are no-ops when already connected.
 */
export function connectLucaToTeamRoom(): void {
  if (_socket?.connected) return; // already live

  const agentToken = getAgentCredential();
  if (!agentToken) {
    console.warn("[LucaPresence] Credential absent — Luca presence unavailable");
    return;
  }
  if (!isValidLucaCredential(agentToken)) {
    console.warn("[LucaPresence] Credential structurally invalid — Luca presence unavailable");
    return;
  }

  // Connect to our own server's /team-room namespace.
  // Using localhost avoids the Replit proxy and is reliable server-to-server.
  const port = process.env.PORT ?? "5000";
  const baseUrl = `http://localhost:${port}`;

  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
  }

  _socket = ioClient(`${baseUrl}/team-room`, {
    auth: { agentToken },
    transports: ["polling", "websocket"], // polling first — avoids WS upgrade race at startup
    reconnection: true,
    reconnectionDelay: 5_000,
    reconnectionDelayMax: 30_000,
    reconnectionAttempts: Infinity,
  });

  _socket.on("connect", async () => {
    _state.connected = true;
    _state.connectedAt = new Date().toISOString();
    _state.socketId = _socket!.id ?? null;
    _state.reconnectAttempts = 0;
    _transportRetryAttempt = 0;
    console.log(`[LucaPresence] Connected to Team Room (socket: ${_socket!.id})`);
    await syncWithActiveRoom();
  });

  // Listen for all room messages to capture nudges directed at Luca
  _socket.on(
    "new_message",
    (msg: {
      id: string;
      speaker: string;
      content: string;
      timestamp?: string;
      roomId?: string;
    }) => {
      if (!isNudgeForLuca(msg.speaker, msg.content)) return;

      const entry: NudgeEntry = {
        id: msg.id,
        from: msg.speaker,
        content: msg.content,
        receivedAt: msg.timestamp ?? new Date().toISOString(),
        roomId: msg.roomId ?? _state.currentRoomId ?? "unknown",
      };
      _nudgeBuffer.push(entry);
      if (_nudgeBuffer.length > NUDGE_BUFFER_LIMIT) {
        _nudgeBuffer = _nudgeBuffer.slice(-NUDGE_BUFFER_LIMIT);
      }
      console.log(`[LucaPresence] Nudge buffered from ${msg.speaker}: ${msg.content.substring(0, 60)}`);

      // Respond to the nudge with Anthropic — fire-and-forget, never block the socket handler
      const snapshot = getCurrentSessionSnapshot();
      respondToNudge(entry, snapshot).catch((err: any) => {
        console.warn('[LucaPresence] Nudge response error:', err.message);
      });
    }
  );

  _socket.on("disconnect", (reason) => {
    const prevConnected = _state.connected;
    _state.connected = false;
    _state.socketId = null;
    console.log(`[LucaPresence] Disconnected: ${reason}`);
    if (prevConnected && _state.currentRoomId) {
      broadcastPresence(_state.currentRoomId, false);
    }
    _state.currentRoomId = null;
    _confirmedRoomIds.clear();
    if (reason !== "io client disconnect") {
      scheduleRoomSyncRetry("transport");
    }
  });

  _socket.on("connect_error", (err) => {
    _state.reconnectAttempts++;
    _transportRetryAttempt += 1;
    if (_state.reconnectAttempts <= 3 || _state.reconnectAttempts % 10 === 0) {
      console.warn(
        `[LucaPresence] Connection error (attempt ${_state.reconnectAttempts}): ${err.message}`
      );
    }
    if (_transportRetryAttempt >= 5) {
      scheduleRoomSyncRetry("transport");
    }
  });

  _socket.on("reconnect", async (attempt: number) => {
    console.log(`[LucaPresence] Reconnected after ${attempt} attempt(s)`);
    _state.connected = true;
    _state.connectedAt = new Date().toISOString();
    _state.socketId = _socket?.id ?? null;

    await syncWithActiveRoom();
  });
}

export const __lucaPresenceTest = {
  setSocket(socket: ClientSocket | null): void {
    _socket = socket;
    _state.connected = Boolean(socket?.connected);
    _state.socketId = socket?.id ?? null;
  },
  setActiveRoomLookup(lookup: () => Promise<string | null>): void {
    _activeRoomLookup = lookup;
  },
  setJoinAckTimeoutMs(timeoutMs: number): void {
    _roomJoinAckTimeoutMs = timeoutMs;
  },
  reset(): void {
    clearRoomSyncTimer();
    _socket = null;
    _activeRoomLookup = getActiveRoomId;
    _roomJoinAckTimeoutMs = DEFAULT_ROOM_JOIN_ACK_TIMEOUT_MS;
    _roomSyncRetryAttempt = 0;
    _roomSyncGeneration += 1;
    _transportRetryAttempt = 0;
    _confirmedRoomIds.clear();
    _state = {
      connected: false,
      currentRoomId: null,
      connectedAt: null,
      reconnectAttempts: 0,
      socketId: null,
    };
  },
};
