import type { Server as SocketIOServer, Namespace, Socket } from "socket.io";

let teamRoomNamespace: Namespace | null = null;

export function initializeTeamRoomWS(io: SocketIOServer) {
  teamRoomNamespace = io.of("/team-room");

  teamRoomNamespace.on("connection", (socket: Socket) => {
    console.log(`[TeamRoomWS] Client connected: ${socket.id}`);

    socket.on("join_room", (roomId: string) => {
      socket.join(`room:${roomId}`);
      console.log(`[TeamRoomWS] ${socket.id} joined room:${roomId}`);
    });

    socket.on("leave_room", (roomId: string) => {
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
