import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "../../shared/events";
import { processAllCharacterQueues } from "./persistence/localStore";
import { createApiRouter } from "./routes";
import { getOnlineUserIds, registerSocketServer } from "./socketServer";

const app = express();
app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json());
app.use("/api", createApiRouter());

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "*"
  }
});

registerSocketServer(io);

setInterval(() => {
  const onlineUsers = getOnlineUserIds();
  void processAllCharacterQueues((userId) => onlineUsers.has(userId));
}, 15000);

const port = 3001;
httpServer.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
