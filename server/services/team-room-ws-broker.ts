import type { Server as SocketIOServer, Namespace, Socket } from "socket.io";
import type { IncomingMessage } from "http";

let teamRoomNamespace: Namespace | null = null;

function extractSessionFromRequest(req: IncomingMessage): boolean {
  const cookie = req.headers.cookie;
  if (!cookie) return false;
  return cookie.includes("connect.sid=") || cookie.includes("replit:authed=");
}

/** Returns true when the socket presents a valid agent token (Luca's identity). */
function isAgentTokenAuth(socket: Socket): boolean {
  const agentToken = (socket.handshake.auth as Record<string, unknown>)?.agentToken;
  const configured = process.env.REPLIT_AGENT_TOKEN;
  return !!(agentToken && configured && agentToken === configured);
}

export function initializeTeamRoomWS(io: SocketIOServer) {
  teamRoomNamespace = io.of("/team-room");

  teamRoomNamespace.use((socket, next) => {
    // Accept Luca's server-side connection (agent token) OR a browser session cookie
    if (isAgentTokenAuth(socket)) {
      (socket.data as Record<string, unknown>).identity = "luca";
      next();
    } else if (extractSessionFromRequest(socket.request)) {
      next();
    } else {
      console.log(`[TeamRoomWS] Rejected unauthenticated connection: ${socket.id}`);
      next(new Error("Authentication required"));
    }
  });

  teamRoomNamespace.on("connection", (socket: Socket) => {
    console.log(`[TeamRoomWS] Client connected: ${socket.id}`);

    socket.on("join_room", (roomId: string) => {
      if (!roomId || typeof roomId !== "string") return;
      socket.join(`room:${roomId}`);
      console.log(`[TeamRoomWS] ${socket.id} joined room:${roomId}`);
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
