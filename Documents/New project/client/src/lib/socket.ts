import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../../../shared/events";

const socketUrl =
  import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? "http://localhost:3001" : window.location.origin);

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(socketUrl, {
      autoConnect: true
    });
  }

  return socket;
}
