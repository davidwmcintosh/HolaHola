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
import { emitToRoom } from "./team-room-ws-broker";
import { respondToNudge } from "./luca-responder";
import { getCurrentSessionSnapshot, startLucaObserver } from "./luca-observer";

// ── Config ────────────────────────────────────────────────────────────────────

const NUDGE_BUFFER_LIMIT = 200;

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
let _state: LucaPresenceState = {
  connected: false,
  currentRoomId: null,
  connectedAt: null,
  reconnectAttempts: 0,
  socketId: null,
};

// Nudge ring-buffer: messages directed @luca from the Team Room
let _nudgeBuffer: NudgeEntry[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true when this message is a nudge directed at Luca. */
function isNudgeForLuca(speaker: string, content: string): boolean {
  if (speaker.toLowerCase() === "luca") return false; // Luca's own outgoing messages
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
export function joinRoom(roomId: string): boolean {
  if (!_socket?.connected) return false;
  if (_state.currentRoomId && _state.currentRoomId !== roomId) {
    _socket.emit("leave_room", _state.currentRoomId);
    broadcastPresence(_state.currentRoomId, false);
  }
  _socket.emit("join_room", roomId);
  _state.currentRoomId = roomId;
  broadcastPresence(roomId, true);
  console.log(`[LucaPresence] Switched to room: ${roomId}`);
  return true;
}

/** Gracefully disconnect Luca's presence socket. */
export function disconnectLuca(): void {
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

  const agentToken = process.env.REPLIT_AGENT_TOKEN;
  if (!agentToken) {
    console.warn(
      "[LucaPresence] REPLIT_AGENT_TOKEN not set — Luca presence unavailable"
    );
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
    console.log(`[LucaPresence] Connected to Team Room (socket: ${_socket!.id})`);

    // Auto-join the currently active room
    const roomId = await getActiveRoomId();
    if (roomId) {
      _socket!.emit("join_room", roomId);
      _state.currentRoomId = roomId;
      broadcastPresence(roomId, true);
      console.log(`[LucaPresence] Joined room: ${roomId}`);
    } else {
      console.log("[LucaPresence] No active room found — will join when a room is created");
    }
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
  });

  _socket.on("connect_error", (err) => {
    _state.reconnectAttempts++;
    if (_state.reconnectAttempts <= 3 || _state.reconnectAttempts % 10 === 0) {
      console.warn(
        `[LucaPresence] Connection error (attempt ${_state.reconnectAttempts}): ${err.message}`
      );
    }
  });

  _socket.on("reconnect", async (attempt: number) => {
    console.log(`[LucaPresence] Reconnected after ${attempt} attempt(s)`);
    _state.connected = true;
    _state.connectedAt = new Date().toISOString();
    _state.socketId = _socket?.id ?? null;

    // Re-join the active room on reconnect
    const roomId = _state.currentRoomId ?? (await getActiveRoomId());
    if (roomId) {
      _socket!.emit("join_room", roomId);
      _state.currentRoomId = roomId;
      broadcastPresence(roomId, true);
    }
  });
}
