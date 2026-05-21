import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.post("/admin/migrate", async (req, res): Promise<void> => {
  const adminKey = process.env.ADMIN_MIGRATE_KEY;
  if (adminKey && req.headers["x-admin-key"] !== adminKey) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
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
    res.json({ ok: true, message: 'Tables created' });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  } finally {
    client.release();
  }
});

export default router;
