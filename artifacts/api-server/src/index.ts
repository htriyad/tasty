import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS folders (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, parent_id INTEGER,
      color TEXT NOT NULL DEFAULT '#6366f1', icon TEXT NOT NULL DEFAULT 'folder',
      style TEXT NOT NULL DEFAULT 'default', position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS question_sets (
      id SERIAL PRIMARY KEY,
      folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      name TEXT NOT NULL, exam_type TEXT, total_questions INTEGER NOT NULL DEFAULT 0,
      source_url TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      set_id INTEGER NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
      chorcha_id TEXT NOT NULL, question_index INTEGER NOT NULL, type TEXT NOT NULL,
      question_text TEXT NOT NULL DEFAULT '', options JSONB NOT NULL DEFAULT '[]',
      parts JSONB NOT NULL DEFAULT '[]', answer TEXT, solution TEXT,
      stem_images TEXT[] NOT NULL DEFAULT '{}', ai_explanation TEXT,
      hidden BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS set_question_links (
      id SERIAL PRIMARY KEY,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      set_id INTEGER NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
      question_index INTEGER NOT NULL DEFAULT 0,
      hidden_parts TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_link UNIQUE (question_id, set_id))`);
    logger.info("Database migrations completed successfully");
  } catch (err) {
    logger.error({ err }, "Database migration failed");
  } finally {
    client.release();
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

runMigrations().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
