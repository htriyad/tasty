import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.post("/admin/migrate", async (req, res): Promise<void> => {
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
    res.json({ ok: true, message: "Tables created" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  } finally {
    client.release();
  }
});

router.post("/admin/import-supabase", async (req, res): Promise<void> => {
  const key = req.headers["x-admin-key"] ?? req.body?.key;
  const adminKey = process.env.ADMIN_MIGRATE_KEY;
  if (!adminKey || key !== adminKey) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: "SUPABASE_URL and SUPABASE_ANON_KEY must be set" });
    return;
  }
  const base = `${supabaseUrl}/rest/v1`;
  const headers: Record<string, string> = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
  const phase = (req.body?.phase as string) ?? "folders";
  const offset = typeof req.body?.offset === "number" ? req.body.offset : 0;
  const limit = 500;

  const client = await pool.connect();
  try {
    if (phase === "folders") {
      const resp = await fetch(`${base}/folders?select=*&order=id.asc&limit=${limit}&offset=${offset}`, { headers });
      if (!resp.ok) { res.status(502).json({ error: await resp.text() }); return; }
      const rows = (await resp.json()) as Record<string, unknown>[];
      let inserted = 0;
      for (const r of rows) {
        await client.query(
          `INSERT INTO folders (id,name,parent_id,color,icon,style,position,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
          [r.id, r.name, r.parent_id ?? null, r.color, r.icon, r.style, r.position, r.created_at]
        );
        inserted++;
      }
      if (inserted > 0) await client.query("SELECT setval('folders_id_seq', (SELECT MAX(id) FROM folders))");
      res.json({ phase, offset, inserted, done: rows.length < limit });
    } else if (phase === "question_sets") {
      const resp = await fetch(`${base}/question_sets?select=*&order=id.asc&limit=${limit}&offset=${offset}`, { headers });
      if (!resp.ok) { res.status(502).json({ error: await resp.text() }); return; }
      const rows = (await resp.json()) as Record<string, unknown>[];
      let inserted = 0;
      for (const r of rows) {
        await client.query(
          `INSERT INTO question_sets (id,folder_id,name,exam_type,total_questions,source_url,sort_order,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
          [r.id, r.folder_id, r.name, r.exam_type ?? null, r.total_questions, r.source_url ?? null, r.sort_order, r.created_at]
        );
        inserted++;
      }
      if (inserted > 0) await client.query("SELECT setval('question_sets_id_seq', (SELECT MAX(id) FROM question_sets))");
      res.json({ phase, offset, inserted, done: rows.length < limit });
    } else if (phase === "questions") {
      const resp = await fetch(`${base}/questions?select=*&order=id.asc&limit=${limit}&offset=${offset}`, { headers });
      if (!resp.ok) { res.status(502).json({ error: await resp.text() }); return; }
      const rows = (await resp.json()) as Record<string, unknown>[];
      let inserted = 0;
      for (const r of rows) {
        await client.query(
          `INSERT INTO questions (id,set_id,chorcha_id,question_index,type,question_text,options,parts,answer,solution,stem_images,ai_explanation,hidden,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11::text[],$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
          [r.id, r.set_id, r.chorcha_id, r.question_index, r.type, r.question_text ?? "",
           JSON.stringify(r.options ?? []), JSON.stringify(r.parts ?? []),
           r.answer ?? null, r.solution ?? null,
           r.stem_images ?? [], r.ai_explanation ?? null, r.hidden ?? false, r.created_at]
        );
        inserted++;
      }
      if (inserted > 0) await client.query("SELECT setval('questions_id_seq', (SELECT MAX(id) FROM questions))");
      res.json({ phase, offset, inserted, done: rows.length < limit });
    } else {
      res.status(400).json({ error: "Unknown phase. Use: folders, question_sets, questions" });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  } finally {
    client.release();
  }
});

export default router;
