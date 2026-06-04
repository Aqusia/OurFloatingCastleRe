import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
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

if (process.env.NODE_ENV === "production") {
  const clientDist = path.resolve(process.cwd(), "client", "dist");
  app.use(express.static(clientDist));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientDist, "index.html"));
  });
}

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

const port = Number(process.env.PORT || 3001);
httpServer.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
