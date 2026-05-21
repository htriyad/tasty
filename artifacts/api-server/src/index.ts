import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { registerBattleHandlers } from "./battle/socketHandlers.js";
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from "./battle/types.js";
import { pool } from "@workspace/db";

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

async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id INTEGER,
        color TEXT NOT NULL DEFAULT '#6366f1',
        icon TEXT NOT NULL DEFAULT 'folder',
        style TEXT NOT NULL DEFAULT 'default',
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS question_sets (
        id SERIAL PRIMARY KEY,
        folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        exam_type TEXT,
        total_questions INTEGER NOT NULL DEFAULT 0,
        source_url TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        set_id INTEGER NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
        chorcha_id TEXT NOT NULL,
        question_index INTEGER NOT NULL,
        type TEXT NOT NULL,
        question_text TEXT NOT NULL DEFAULT '',
        options JSONB NOT NULL DEFAULT '[]',
        parts JSONB NOT NULL DEFAULT '[]',
        answer TEXT,
        solution TEXT,
        stem_images TEXT[] NOT NULL DEFAULT '{}',
        ai_explanation TEXT,
        hidden BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS set_question_links (
        id SERIAL PRIMARY KEY,
        question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        set_id INTEGER NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
        question_index INTEGER NOT NULL DEFAULT 0,
        hidden_parts TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_link UNIQUE (question_id, set_id)
      )
    `);
    logger.info("DB migrations complete — all tables exist");
  } finally {
    client.release();
  }
}

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
    httpServer.listen(port, () => {
      logger.info({ port }, "Server listening with Socket.IO");
    });
  })
  .catch((err) => {
    logger.error({ err }, "DB migration failed — exiting");
    process.exit(1);
  });
