import type { Server, Socket } from "socket.io";
import type { AuthUser, CharacterProfile, ClientToServerEvents, ServerToClientEvents } from "../../shared/events";
import { authenticateToken } from "./auth";
import {
  attachBattleLoop,
  createRoom,
  getRoomForSocket,
  getRoomState,
  isUserInRoom,
  joinRoom,
  leaveRoom,
  listRoomSummaries,
  publicRoomState,
  runBattleTick,
  startBattle,
  updateLoadoutForSocket
} from "./game";
import { getCharacterByUserId, isCharacterBusy, processCharacterQueue } from "./persistence/localStore";

type SocketContext = {
  user: AuthUser;
  character: CharacterProfile;
};

const authenticatedSockets = new Map<string, SocketContext>();

export function getOnlineUserIds() {
  return new Set(Array.from(authenticatedSockets.values()).map((context) => context.user.id));
}

function emitLobby(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  io.to("lobby").emit("lobby:rooms", listRoomSummaries());
}

function emitRoomState(io: Server<ClientToServerEvents, ServerToClientEvents>, roomId: string) {
  const room = getRoomState(roomId);
  if (!room) {
    io.to(roomId).emit("room:state", null);
    return;
  }
  io.to(roomId).emit("room:state", publicRoomState(room));
}

function syncSocketDeparture(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  emitNullStateToSocket: boolean
) {
  const currentRoom = getRoomForSocket(socket.id);
  if (!currentRoom) {
    if (emitNullStateToSocket) {
      socket.emit("room:state", null);
    }
    return null;
  }

  const roomId = currentRoom.roomId;
  socket.leave(roomId);
  const updatedRoom = leaveRoom(socket.id);

  if (emitNullStateToSocket) {
    socket.emit("room:state", null);
  }

  if (updatedRoom) {
    emitRoomState(io, updatedRoom.roomId);
  } else {
    io.to(roomId).emit("room:state", null);
  }

  emitLobby(io);
  return updatedRoom;
}

async function withAuth(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
  const context = authenticatedSockets.get(socket.id);
  if (!context) {
    socket.emit("app:error", "尚未登入。");
    return null;
  }

  const processed = await processCharacterQueue(context.user.id, true);
  const latestCharacter = await getCharacterByUserId(context.user.id);
  if (!latestCharacter) {
    socket.emit("app:error", "找不到角色資料。");
    return null;
  }

  const nextContext = {
    user: context.user,
    character: latestCharacter
  };

  authenticatedSockets.set(socket.id, nextContext);
  if (processed.completedActivities.length > 0) {
    socket.emit("character:updated", latestCharacter);
  }

  return nextContext;
}

function ensureBattleAvailable(socket: Socket<ClientToServerEvents, ServerToClientEvents>, context: SocketContext) {
  if (isCharacterBusy(context.character)) {
    socket.emit("app:error", "角色正在處理其他行動，請先等待隊列完成。");
    return false;
  }
  return true;
}

export function registerSocketServer(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    socket.on("auth:ready", async (token) => {
      const auth = await authenticateToken(token);
      if (!auth) {
        socket.emit("app:error", "登入狀態失效，請重新登入。");
        return;
      }

      const processed = await processCharacterQueue(auth.user.id, true);
      const nextContext = {
        user: auth.user,
        character: processed.character
      };
      authenticatedSockets.set(socket.id, nextContext);
      socket.emit("auth:ready", nextContext);
      socket.join("lobby");
      socket.emit("lobby:rooms", listRoomSummaries());
    });

    socket.on("lobby:subscribe", async () => {
      const auth = await withAuth(socket);
      if (!auth) {
        return;
      }

      socket.join("lobby");
      socket.emit("lobby:rooms", listRoomSummaries());
      socket.emit("character:updated", auth.character);
    });

    socket.on("room:create", async (requestedRoomId) => {
      const auth = await withAuth(socket);
      if (!auth || !ensureBattleAvailable(socket, auth)) {
        return;
      }

      try {
        syncSocketDeparture(io, socket, false);
        const room = createRoom(auth.user, auth.character, socket.id, requestedRoomId);
        socket.join(room.roomId);
        socket.emit("room:state", publicRoomState(room));
        emitRoomState(io, room.roomId);
        emitLobby(io);
      } catch (error) {
        socket.emit("app:error", error instanceof Error ? error.message : "建立隊伍失敗。");
      }
    });

    socket.on("room:join", async (roomId) => {
      const auth = await withAuth(socket);
      if (!auth || !ensureBattleAvailable(socket, auth)) {
        return;
      }

      try {
        syncSocketDeparture(io, socket, false);
        const room = joinRoom(roomId.trim().toUpperCase(), auth.user, auth.character, socket.id);
        socket.join(room.roomId);
        socket.emit("room:state", publicRoomState(room));
        emitRoomState(io, room.roomId);
        emitLobby(io);
      } catch (error) {
        socket.emit("app:error", error instanceof Error ? error.message : "加入房間失敗。");
      }
    });

    socket.on("room:leave", async () => {
      const auth = await withAuth(socket);
      if (!auth) {
        return;
      }
      syncSocketDeparture(io, socket, true);
    });

    socket.on("room:updateLoadout", async (loadout) => {
      const auth = await withAuth(socket);
      if (!auth) {
        return;
      }

      try {
        const result = await updateLoadoutForSocket(socket.id, loadout);
        authenticatedSockets.set(socket.id, {
          user: auth.user,
          character: result.character
        });
        socket.emit("character:updated", result.character);
        emitRoomState(io, result.room.roomId);
      } catch (error) {
        socket.emit("app:error", error instanceof Error ? error.message : "更新房間配置失敗。");
      }
    });

    socket.on("room:start", async (roomId) => {
      const auth = await withAuth(socket);
      if (!auth) {
        return;
      }
      if (isUserInRoom(auth.user.id) && isCharacterBusy(auth.character)) {
        socket.emit("app:error", "角色忙碌中，暫時不能開始戰鬥。");
        return;
      }

      try {
        const room = startBattle(roomId, auth.user.id);
        emitRoomState(io, room.roomId);
        emitLobby(io);

        attachBattleLoop(
          room.roomId,
          async () => {
            const result = await runBattleTick(room.roomId);
            if (!result) {
              return;
            }

            emitRoomState(io, result.room.roomId);
            io.to(result.room.roomId).emit("battle:tick", result.event);

            if (result.summary) {
              for (const member of result.room.members) {
                io.to(member.socketId).emit("character:updated", member.character);
              }
              io.to(result.room.roomId).emit("battle:ended", {
                roomId: result.room.roomId,
                summary: result.summary
              });
              emitLobby(io);
            }
          },
          room.battleConfig?.tickIntervalMs || 2000
        );
      } catch (error) {
        socket.emit("app:error", error instanceof Error ? error.message : "開始戰鬥失敗。");
      }
    });

    socket.on("disconnect", () => {
      syncSocketDeparture(io, socket, false);
      authenticatedSockets.delete(socket.id);
    });
  });
}
