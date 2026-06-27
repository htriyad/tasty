import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/saved", async (req, res): Promise<void> => {
  const session = typeof req.query.session === "string" ? req.query.session.trim() : "";
  if (!session) { res.status(400).json({ error: "session required" }); return; }
  const result = await db.execute(sql`
    SELECT
      sq.id, sq.question_id, sq.question_text, sq.set_id, sq.set_name,
      sq.question_type, sq.is_starred, sq.saved_at,
      q.options, q.answer, q.parts, q.solution, q.stem_images,
      f1.name  AS folder_name,
      f2.name  AS folder_parent_name,
      f3.name  AS folder_grandparent_name
    FROM saved_questions sq
    LEFT JOIN questions     q   ON q.id   = CAST(sq.question_id AS INTEGER)
    LEFT JOIN question_sets qs  ON qs.id  = sq.set_id
    LEFT JOIN folders       f1  ON f1.id  = qs.folder_id
    LEFT JOIN folders       f2  ON f2.id  = f1.parent_id
    LEFT JOIN folders       f3  ON f3.id  = f2.parent_id
    WHERE sq.session_id = ${session}
    ORDER BY sq.saved_at DESC
  `);
  res.json(result.rows);
});

router.get("/saved/practice", async (req, res): Promise<void> => {
  const session = typeof req.query.session === "string" ? req.query.session.trim() : "";
  if (!session) { res.status(400).json({ error: "session required" }); return; }
  const starredOnly = req.query.starred === "true";
  const result = await db.execute(sql`
    SELECT q.id, q.question_text, q.options, q.answer, q.type, q.stem_images,
           sq.is_starred, sq.set_name
    FROM saved_questions sq
    JOIN questions q ON q.id = CAST(sq.question_id AS INTEGER)
    WHERE sq.session_id = ${session}
      AND q.type = 'mcq'
      AND q.hidden = FALSE
      AND jsonb_array_length(q.options) > 0
      AND q.answer IS NOT NULL AND q.answer != ''
      ${starredOnly ? sql`AND sq.is_starred = TRUE` : sql``}
    ORDER BY sq.saved_at DESC
  `);
  const rows = [...result.rows].sort(() => Math.random() - 0.5);
  res.json(rows);
});

router.post("/saved", async (req, res): Promise<void> => {
  const { session, questionId, questionText, setId, setName, questionType } = req.body ?? {};
  if (!session || !questionId) { res.status(400).json({ error: "session and questionId required" }); return; }
  await db.execute(sql`
    INSERT INTO saved_questions (session_id, question_id, question_text, set_id, set_name, question_type)
    VALUES (${session}, ${String(questionId)}, ${questionText ?? ""}, ${setId ?? null}, ${setName ?? null}, ${questionType ?? "mcq"})
    ON CONFLICT (session_id, question_id) DO NOTHING
  `);
  res.status(201).json({ ok: true });
});

router.delete("/saved/:questionId", async (req, res): Promise<void> => {
  const session = typeof req.query.session === "string" ? req.query.session.trim() : "";
  if (!session) { res.status(400).json({ error: "session required" }); return; }
  await db.execute(sql`
    DELETE FROM saved_questions WHERE session_id = ${session} AND question_id = ${req.params.questionId}
  `);
  res.status(204).send();
});

router.patch("/saved/:questionId/star", async (req, res): Promise<void> => {
  const session = typeof req.query.session === "string" ? req.query.session.trim() : "";
  if (!session) { res.status(400).json({ error: "session required" }); return; }
  const result = await db.execute(sql`
    UPDATE saved_questions SET is_starred = NOT is_starred
    WHERE session_id = ${session} AND question_id = ${req.params.questionId}
    RETURNING is_starred
  `);
  if (!result.rows.length) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ isStarred: result.rows[0].is_starred });
});

export default router;