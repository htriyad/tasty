import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/saved", async (req, res): Promise<void> => {
  const session = typeof req.query.session === "string" ? req.query.session.trim() : "";
  if (!session) { res.status(400).json({ error: "session required" }); return; }
  const result = await db.execute(sql`
    SELECT id, question_id, question_text, set_id, set_name, question_type, is_starred, saved_at
    FROM saved_questions WHERE session_id = ${session} ORDER BY saved_at DESC
  `);
  res.json(result.rows);
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
