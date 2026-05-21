import { Router, type IRouter } from "express";
import pg from "pg";

const { Client } = pg;
const PW = "my1stprojec";
const REF = "lngxtnsgbnoklcycvuhz";

const CANDIDATES = [
  // Direct (session mode — IPv6 on Supabase, might not work)
  `postgresql://postgres:${PW}@db.${REF}.supabase.co:5432/postgres?sslmode=require`,
  // Pooler session mode port 5432 — all regions
  `postgresql://postgres.${REF}:${PW}@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`,
  `postgresql://postgres.${REF}:${PW}@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=require`,
  `postgresql://postgres.${REF}:${PW}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require`,
  `postgresql://postgres.${REF}:${PW}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require`,
  `postgresql://postgres.${REF}:${PW}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require`,
  `postgresql://postgres.${REF}:${PW}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require`,
  `postgresql://postgres.${REF}:${PW}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require`,
  `postgresql://postgres.${REF}:${PW}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require`,
  `postgresql://postgres.${REF}:${PW}@aws-0-ca-central-1.pooler.supabase.com:5432/postgres?sslmode=require`,
  // Pooler transaction mode port 6543 — top candidates
  `postgresql://postgres.${REF}:${PW}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`,
  `postgresql://postgres.${REF}:${PW}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require`,
];

const SQL = `
CREATE TABLE IF NOT EXISTS folders (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, parent_id INTEGER,
  color TEXT NOT NULL DEFAULT '#6366f1', icon TEXT NOT NULL DEFAULT 'folder',
  style TEXT NOT NULL DEFAULT 'default', position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS question_sets (
  id SERIAL PRIMARY KEY,
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL, exam_type TEXT, total_questions INTEGER NOT NULL DEFAULT 0,
  source_url TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  set_id INTEGER NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  chorcha_id TEXT NOT NULL, question_index INTEGER NOT NULL, type TEXT NOT NULL,
  question_text TEXT NOT NULL DEFAULT '', options JSONB NOT NULL DEFAULT '[]',
  parts JSONB NOT NULL DEFAULT '[]', answer TEXT, solution TEXT,
  stem_images TEXT[] NOT NULL DEFAULT '{}', ai_explanation TEXT,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS set_question_links (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  set_id INTEGER NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL DEFAULT 0,
  hidden_parts TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_link UNIQUE (question_id, set_id));
`;

const router: IRouter = Router();

router.post("/admin/migrate", async (req, res): Promise<void> => {
  if (req.headers["x-admin-key"] !== "run-migration-now-2026") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const results: Record<string, string> = {};
  for (const url of CANDIDATES) {
    const label = url.replace(`postgres:${PW}@`, "postgres:***@");
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 4000, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(SQL);
      await client.end();
      res.json({ ok: true, working_url: label });
      return;
    } catch (e: unknown) {
      results[label] = (e as Error).message?.slice(0, 80) ?? "unknown";
      try { await client.end(); } catch {}
    }
  }
  res.status(500).json({ error: "No connection worked", results });
});

export default router;
