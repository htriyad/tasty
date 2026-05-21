import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { registerBattleHandlers } from "./battle/socketHandlers.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./battle/types.js";
import { runMigrations } from "@workspace/db/migrate";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — keeping server alive");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection — keeping server alive");
});

const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  {
    cors: { origin: true, credentials: true },
    path: "/api/socket.io",
  }
);

registerBattleHandlers(io);

httpServer.on("error", (err) => {
  logger.error({ err }, "HTTP server error");
});

runMigrations()
  .then(() => {
    logger.info("DB migrations complete");
    httpServer.listen(port, () => {
      logger.info({ port }, "Server listening with Socket.IO");
    });
  })
  .catch((err) => {
    logger.error({ err }, "DB migration failed — exiting");
    process.exit(1);
  });
