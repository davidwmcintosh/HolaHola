import type { Server as SocketIOServer, Namespace, Socket } from "socket.io";
import type { IncomingMessage } from "http";
import crypto from "node:crypto";
import { parse as parseCookie } from "cookie";
import signature from "cookie-signature";
import { eq } from "drizzle-orm";
import { getSharedDb } from "../db";
import { sessions, teamRooms, users } from "../../shared/schema";
import { isFounder } from "../middleware/rbac";

let teamRoomNamespace: Namespace | null = null;
type LucaPresenceSnapshot = {
  connected: boolean;
  currentRoomId: string | null;
  connectedAt: string | null;
  socketId: string | null;
};
let readLucaPresenceState: (() => LucaPresenceSnapshot) | null = null;
type BrowserAuthResult = { userId: string; isFounder: boolean };
type SessionRecord = { sess: unknown; expire: Date };
type TeamRoomAuthDependencies = {
  verifyBrowserSession?: (cookieHeader: string | undefined) => Promise<BrowserAuthResult | null>;
  readSession?: (sessionId: string) => Promise<SessionRecord | null>;
  readUser?: (userId: string) => Promise<any | null>;
  roomExists?: (roomId: string) => Promise<boolean>;
};

let verifyBrowserSession: (cookieHeader: string | undefined) => Promise<BrowserAuthResult | null> =
  verifyBrowserSessionFromConfiguredReaders;
let readSession: (sessionId: string) => Promise<SessionRecord | null> = readSessionFromStore;
let readUser: (userId: string) => Promise<any | null> = readUserFromStore;
let roomExists: (roomId: string) => Promise<boolean> = async (roomId) => {
  const [room] = await getSharedDb().select({ id: teamRooms.id }).from(teamRooms).where(eq(teamRooms.id, roomId)).limit(1);
  return Boolean(room);
};

/** Register Luca's live state accessor without creating a second state cache. */
export function registerLucaPresenceStateReader(reader: () => LucaPresenceSnapshot): void {
  readLucaPresenceState = reader;
}

export function configureTeamRoomWSAuth(dependencies: TeamRoomAuthDependencies): void {
  readSession = dependencies.readSession ?? readSessionFromStore;
  readUser = dependencies.readUser ?? readUserFromStore;
  verifyBrowserSession = dependencies.verifyBrowserSession ?? verifyBrowserSessionFromConfiguredReaders;
  roomExists = dependencies.roomExists ?? (async (roomId) => {
    const [room] = await getSharedDb().select({ id: teamRooms.id }).from(teamRooms).where(eq(teamRooms.id, roomId)).limit(1);
    return Boolean(room);
  });
}

/**
 * Luca is online in a room only when the server-side presence socket is
 * connected and its local room state points at that room.  Keeping this
 * predicate here makes the join replay use the same state as later
 * broadcasts, rather than introducing another presence cache.
 */
export function isLucaOnlineInRoom(
  roomId: string,
  state = readLucaPresenceState?.() ?? {
    connected: false,
    currentRoomId: null,
    connectedAt: null,
    socketId: null,
  },
): boolean {
  return state.connected && state.currentRoomId === roomId;
}

export type TeamRoomJoinAck =
  | { ok: true; roomId: string; requestId?: string }
  | {
      ok: false;
      roomId: string;
      requestId?: string;
      error: "invalid-room" | "room-not-found" | "lookup-failed" | "superseded";
    };

type TeamRoomJoinRequest = string | { roomId: string; requestId: string };

async function readSessionFromStore(sessionId: string): Promise<SessionRecord | null> {
  const [row] = await getSharedDb()
    .select({ sess: sessions.sess, expire: sessions.expire })
    .from(sessions)
    .where(eq(sessions.sid, sessionId))
    .limit(1);
  return row ? { sess: row.sess, expire: row.expire } : null;
}

async function readUserFromStore(userId: string): Promise<any | null> {
  const [user] = await getSharedDb().select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

async function verifyBrowserSessionFromConfiguredReaders(cookieHeader: string | undefined): Promise<BrowserAuthResult | null> {
  if (!cookieHeader || !process.env.SESSION_SECRET) return null;
  const sessionCookie = parseCookie(cookieHeader)["connect.sid"];
  if (!sessionCookie || !sessionCookie.startsWith("s:")) return null;
  const sessionId = signature.unsign(sessionCookie.slice(2), process.env.SESSION_SECRET);
  if (sessionId === false) return null;

  const row = await readSession(sessionId);
  if (!row || row.expire <= new Date()) return null;
  const sessionData = row.sess as any;
  const userId = sessionData?.userId ?? sessionData?.passport?.user?.claims?.sub;
  if (typeof userId !== "string" || !userId) return null;

  const user = await readUser(userId);
  if (!user || !isFounder(user)) return null;
  return { userId, isFounder: true };
}

/** Returns true when the socket presents a valid agent token (Luca's identity). */
function isAgentTokenAuth(socket: Socket): boolean {
  const agentToken = (socket.handshake.auth as Record<string, unknown>)?.agentToken;
  if (typeof agentToken !== 'string') return false;
  const dedicated = process.env.COORDINATION_LUCA_REPLIT_TOKEN?.trim();
  return Boolean(
    dedicated &&
    dedicated.length >= 32 &&
    agentToken.length === dedicated.length &&
    crypto.timingSafeEqual(Buffer.from(agentToken), Buffer.from(dedicated)),
  );
}

function hasAgentToken(socket: Socket): boolean {
  return typeof (socket.handshake.auth as Record<string, unknown>)?.agentToken === "string";
}

function isValidRoomId(roomId: unknown): roomId is string {
  return typeof roomId === "string" && roomId.length > 0 && roomId.length <= 128 && /^[A-Za-z0-9_-]+$/.test(roomId);
}

export function initializeTeamRoomWS(io: SocketIOServer) {
  teamRoomNamespace = io.of("/team-room");

  teamRoomNamespace.use(async (socket, next) => {
    // Accept Luca's server-side connection (agent token) OR a browser session cookie
    if (isAgentTokenAuth(socket)) {
      (socket.data as Record<string, unknown>).identity = "luca";
      next();
    } else {
      if (hasAgentToken(socket)) {
        return next(new Error("Authentication required"));
      }
      let browserAuth: BrowserAuthResult | null = null;
      try {
        browserAuth = await verifyBrowserSession(socket.request.headers.cookie);
      } catch {
        browserAuth = null;
      }
      if (!browserAuth) {
        console.log(`[TeamRoomWS] Rejected unauthenticated connection: ${socket.id}`);
        return next(new Error("Authentication required"));
      }
      (socket.data as Record<string, unknown>).identity = "browser";
      (socket.data as Record<string, unknown>).userId = browserAuth.userId;
      next();
    }
  });

  teamRoomNamespace.on("connection", (socket: Socket) => {
    console.log(`[TeamRoomWS] Client connected: ${socket.id}`);
    let latestLucaJoinRequest: { requestId: string; roomId: string } | null = null;

    socket.on("join_room", async (
      request: TeamRoomJoinRequest,
      acknowledge?: (result: TeamRoomJoinAck) => void,
    ) => {
      const roomId = typeof request === "string" ? request : request?.roomId;
      const requestId = typeof request === "string" ? undefined : request?.requestId;
      const isVersionedLucaJoin =
        socket.data.identity === "luca" &&
        typeof requestId === "string" &&
        requestId.length > 0 &&
        requestId.length <= 64;
      if (isVersionedLucaJoin && typeof roomId === "string") {
        latestLucaJoinRequest = { requestId, roomId };
      }

      if (!isValidRoomId(roomId)) {
        acknowledge?.({
          ok: false,
          roomId: String(roomId ?? ""),
          ...(requestId ? { requestId } : {}),
          error: "invalid-room",
        });
        return;
      }
      try {
        if (!(await roomExists(roomId))) {
          acknowledge?.({
            ok: false,
            roomId,
            ...(requestId ? { requestId } : {}),
            error: "room-not-found",
          });
          return;
        }
      } catch {
        acknowledge?.({
          ok: false,
          roomId,
          ...(requestId ? { requestId } : {}),
          error: "lookup-failed",
        });
        return;
      }
      if (isVersionedLucaJoin && latestLucaJoinRequest?.requestId !== requestId) {
        acknowledge?.({ ok: false, roomId, requestId, error: "superseded" });
        return;
      }
      await socket.join(`room:${roomId}`);
      if (isVersionedLucaJoin && latestLucaJoinRequest?.requestId !== requestId) {
        if (latestLucaJoinRequest?.roomId !== roomId) {
          await socket.leave(`room:${roomId}`);
        }
        acknowledge?.({ ok: false, roomId, requestId, error: "superseded" });
        return;
      }
      console.log(`[TeamRoomWS] ${socket.id} joined room:${roomId}`);
      acknowledge?.({ ok: true, roomId, ...(requestId ? { requestId } : {}) });

      // A browser joining after Luca's initial broadcast still needs the
      // current snapshot. Luca's own socket is excluded: it is the source
      // of presence transitions, not a consumer of the browser replay.
      if (socket.data.identity !== "luca") {
        const state = readLucaPresenceState?.() ?? {
          connected: false,
          currentRoomId: null,
          connectedAt: null,
          socketId: null,
        };
        socket.emit("luca_presence", {
          online: isLucaOnlineInRoom(roomId, state),
          connectedAt: state.connectedAt,
        });
      }
    });

    socket.on("leave_room", (roomId: string) => {
      if (!roomId || typeof roomId !== "string") return;
      socket.leave(`room:${roomId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[TeamRoomWS] Client disconnected: ${socket.id}`);
    });
  });

  console.log("[TeamRoomWS] Namespace /team-room initialized");
}

export function emitToRoom(roomId: string, event: string, data: unknown) {
  if (!teamRoomNamespace) return;
  teamRoomNamespace.to(`room:${roomId}`).emit(event, data);
}

export function emitNewMessage(roomId: string, message: unknown) {
  emitToRoom(roomId, "new_message", message);
}

export function emitExpressLane(roomId: string, items: unknown[]) {
  if (items.length === 0) return;
  emitToRoom(roomId, "express_lane", items);
}

export function emitArtifact(roomId: string, artifact: unknown) {
  emitToRoom(roomId, "new_artifact", artifact);
}

export function emitParticipantThinking(roomId: string, participants: string[]) {
  emitToRoom(roomId, "participants_thinking", participants);
}

export function emitParticipantsDone(roomId: string) {
  emitToRoom(roomId, "participants_done", {});
}

export function emitSessionClosed(roomId: string, summary: unknown) {
  emitToRoom(roomId, "session_closed", summary);
}
