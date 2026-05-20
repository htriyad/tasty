import { Router, type IRouter } from "express";
import { db, questionSetsTable, questionsTable, setQuestionLinksTable, foldersTable } from "@workspace/db";
import { eq, asc, sql, inArray, ilike } from "drizzle-orm";

const router: IRouter = Router();

router.get("/folders/:id/sets", async (req, res) => {
  const folderId = parseInt(req.params.id, 10);
  if (!Number.isFinite(folderId)) return res.status(400).json({ error: "Invalid folder id" });
  const sets = await db.select().from(questionSetsTable).where(eq(questionSetsTable.folderId, folderId)).orderBy(asc(questionSetsTable.sortOrder), asc(questionSetsTable.createdAt));
  return res.json(sets);
});

router.get("/questions/lookup", async (req, res) => {
  const id = parseInt(req.query.id as string, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid question id" });

  // First check if it's an owned question
  const [owned] = await db
    .select({
      id: questionsTable.id,
      type: questionsTable.type,
      questionText: questionsTable.questionText,
      questionIndex: questionsTable.questionIndex,
      setId: questionSetsTable.id,
      setName: questionSetsTable.name,
      folderId: questionSetsTable.folderId,
    })
    .from(questionsTable)
    .innerJoin(questionSetsTable, eq(questionsTable.setId, questionSetsTable.id))
    .where(eq(questionsTable.id, id))
    .limit(1);

  if (owned) return res.json(owned);

  return res.status(404).json({ error: "Question not found" });
});

router.get("/sets/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const sets = await db
    .select({
      id: questionSetsTable.id,
      name: questionSetsTable.name,
      folderId: questionSetsTable.folderId,
      folderName: foldersTable.name,
      totalQuestions: questionSetsTable.totalQuestions,
    })
    .from(questionSetsTable)
    .innerJoin(foldersTable, eq(questionSetsTable.folderId, foldersTable.id))
    .where(q ? ilike(questionSetsTable.name, `%${q}%`) : undefined)
    .orderBy(asc(foldersTable.name), asc(questionSetsTable.sortOrder), asc(questionSetsTable.createdAt));
  return res.json(sets);
});

router.get("/sets/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const [set] = await db.select().from(questionSetsTable).where(eq(questionSetsTable.id, id)).limit(1);
  if (!set) return res.status(404).json({ error: "Question set not found" });

  // Owned questions
  const owned = await db.select().from(questionsTable)
    .where(eq(questionsTable.setId, id))
    .orderBy(asc(questionsTable.questionIndex));

  // Linked questions (zero-copy references from other sets)
  const links = await db.select().from(setQuestionLinksTable)
    .where(eq(setQuestionLinksTable.setId, id))
    .orderBy(asc(setQuestionLinksTable.questionIndex));

  let linked: (typeof owned[number] & { linkId: number; hiddenParts: string[] })[] = [];
  if (links.length > 0) {
    const linkedQs = await db.select().from(questionsTable)
      .where(inArray(questionsTable.id, links.map(l => l.questionId)));
    linked = links.map(link => {
      const q = linkedQs.find(q => q.id === link.questionId)!;
      return { ...q, questionIndex: link.questionIndex, linkId: link.id, hiddenParts: link.hiddenParts };
    }).filter(q => q.id != null);
  }

  // Merge owned + linked, sort by questionIndex
  const questions = [...owned.map(q => ({ ...q, linkId: null as number | null, hiddenParts: [] as string[] })), ...linked]
    .sort((a, b) => a.questionIndex - b.questionIndex);

  return res.json({ set, questions });
});

router.post("/folders/:id/sets", async (req, res) => {
  const folderId = parseInt(req.params.id, 10);
  if (!Number.isFinite(folderId)) return res.status(400).json({ error: "Invalid folder id" });
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) return res.status(400).json({ error: "Name is required" });
  const examType = typeof req.body?.examType === "string" ? req.body.examType.trim() || null : null;
  const [set] = await db.insert(questionSetsTable).values({ folderId, name, examType, totalQuestions: 0 }).returning();
  return res.status(201).json(set);
});

router.delete("/sets/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const [set] = await db.select({ id: questionSetsTable.id }).from(questionSetsTable).where(eq(questionSetsTable.id, id)).limit(1);
  if (!set) return res.status(404).json({ error: "Question set not found" });
  await db.delete(questionSetsTable).where(eq(questionSetsTable.id, id));
  return res.status(204).send();
});

router.patch("/sets/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const [set] = await db.select({ id: questionSetsTable.id }).from(questionSetsTable).where(eq(questionSetsTable.id, id)).limit(1);
  if (!set) return res.status(404).json({ error: "Question set not found" });
  const patch: Record<string, unknown> = {};
  if (typeof req.body?.name === "string" && req.body.name.trim()) patch.name = req.body.name.trim();
  if (typeof req.body?.examType === "string") patch.examType = req.body.examType || null;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields to update" });
  const [updated] = await db.update(questionSetsTable).set(patch).where(eq(questionSetsTable.id, id)).returning();
  return res.json(updated);
});

router.post("/folders/:id/sets/reorder", async (req, res) => {
  const folderId = parseInt(req.params.id, 10);
  if (!Number.isFinite(folderId)) return res.status(400).json({ error: "Invalid folder id" });
  const items: { id: number; position: number }[] = req.body?.items ?? [];
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items required" });
  await Promise.all(items.map(item =>
    db.update(questionSetsTable).set({ sortOrder: item.position }).where(eq(questionSetsTable.id, item.id))
  ));
  return res.json({ ok: true });
});

// Reorder questions: renumbers all questions serially so serial = position
router.post("/sets/:id/questions/reorder", async (req, res) => {
  const setId = parseInt(req.params.id, 10);
  if (!Number.isFinite(setId)) return res.status(400).json({ error: "Invalid set id" });
  const items: { id: number; position: number }[] = req.body?.items ?? [];
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items required" });
  // Use sequential positions 1,2,3... to keep serial numbers clean
  await Promise.all(items.map(item =>
    db.update(questionsTable).set({ questionIndex: item.position }).where(eq(questionsTable.id, item.id))
  ));
  return res.json({ ok: true });
});

router.post("/sets/:id/questions", async (req, res) => {
  const setId = parseInt(req.params.id, 10);
  if (!Number.isFinite(setId)) return res.status(400).json({ error: "Invalid set id" });
  const [set] = await db.select({ id: questionSetsTable.id }).from(questionSetsTable).where(eq(questionSetsTable.id, setId)).limit(1);
  if (!set) return res.status(404).json({ error: "Question set not found" });

  const type = typeof req.body?.type === "string" ? req.body.type : "mcq";
  const existing = await db.select({ idx: questionsTable.questionIndex }).from(questionsTable).where(eq(questionsTable.setId, setId)).orderBy(asc(questionsTable.questionIndex));
  const nextIndex = existing.length > 0 ? (existing[existing.length - 1].idx ?? 0) + 1 : 1;

  const defaultOptions = type === "mcq" ? [{ letter: "A", text: "" }, { letter: "B", text: "" }, { letter: "C", text: "" }, { letter: "D", text: "" }] : [];
  const defaultParts = type === "cq" ? [
    { key: "A", label: "ক", text: "", solution: null, aiSolution: null },
    { key: "B", label: "খ", text: "", solution: null, aiSolution: null },
    { key: "C", label: "গ", text: "", solution: null, aiSolution: null },
    { key: "D", label: "ঘ", text: "", solution: null, aiSolution: null },
  ] : [];

  const [q] = await db.insert(questionsTable).values({
    setId, chorchaId: `manual-${Date.now()}`, questionIndex: nextIndex,
    type, questionText: "", options: defaultOptions, parts: defaultParts,
    answer: null, solution: null, stemImages: [], aiExplanation: null, hidden: false,
  }).returning();

  await db.update(questionSetsTable).set({ totalQuestions: sql`${questionSetsTable.totalQuestions} + 1` }).where(eq(questionSetsTable.id, setId));

  return res.status(201).json(q);
});

router.patch("/questions/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const [q] = await db.select({ id: questionsTable.id }).from(questionsTable).where(eq(questionsTable.id, id)).limit(1);
  if (!q) return res.status(404).json({ error: "Question not found" });

  const patch: Record<string, unknown> = {};
  if (typeof req.body?.questionText === "string") patch.questionText = req.body.questionText;
  if (typeof req.body?.type === "string") patch.type = req.body.type;
  if (req.body?.options !== undefined) patch.options = req.body.options;
  if (req.body?.parts !== undefined) patch.parts = req.body.parts;
  if (req.body?.answer !== undefined) patch.answer = req.body.answer || null;
  if (req.body?.solution !== undefined) patch.solution = req.body.solution || null;
  if (req.body?.aiExplanation !== undefined) patch.aiExplanation = req.body.aiExplanation || null;
  if (req.body?.stemImages !== undefined) patch.stemImages = req.body.stemImages;
  if (typeof req.body?.hidden === "boolean") patch.hidden = req.body.hidden;

  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "No fields to update" });

  const [updated] = await db.update(questionsTable).set(patch).where(eq(questionsTable.id, id)).returning();
  return res.json(updated);
});

router.delete("/questions/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const [q] = await db.select({ id: questionsTable.id, setId: questionsTable.setId }).from(questionsTable).where(eq(questionsTable.id, id)).limit(1);
  if (!q) return res.status(404).json({ error: "Question not found" });
  await db.delete(questionsTable).where(eq(questionsTable.id, id));
  await db.update(questionSetsTable).set({ totalQuestions: sql`GREATEST(${questionSetsTable.totalQuestions} - 1, 0)` }).where(eq(questionSetsTable.id, q.setId));
  return res.status(204).send();
});

// ── Link endpoints ─────────────────────────────────────────────────────────────

router.post("/sets/:setId/link-questions", async (req, res) => {
  const setId = parseInt(req.params.setId, 10);
  if (!Number.isFinite(setId)) return res.status(400).json({ error: "Invalid set id" });
  const [set] = await db.select({ id: questionSetsTable.id }).from(questionSetsTable).where(eq(questionSetsTable.id, setId)).limit(1);
  if (!set) return res.status(404).json({ error: "Question set not found" });

  const questionIds: number[] = Array.isArray(req.body?.questionIds) ? req.body.questionIds : [];
  if (questionIds.length === 0) return res.status(400).json({ error: "questionIds required" });

  // Find highest current index in the target set (owned + linked)
  const [ownedMax] = await db.select({ max: sql<number>`COALESCE(MAX(${questionsTable.questionIndex}), 0)` })
    .from(questionsTable).where(eq(questionsTable.setId, setId));
  const [linkedMax] = await db.select({ max: sql<number>`COALESCE(MAX(${setQuestionLinksTable.questionIndex}), 0)` })
    .from(setQuestionLinksTable).where(eq(setQuestionLinksTable.setId, setId));
  let nextIndex = Math.max(Number(ownedMax?.max ?? 0), Number(linkedMax?.max ?? 0)) + 1;

  // Skip questions already linked to avoid duplicate constraint
  const existing = await db.select({ questionId: setQuestionLinksTable.questionId })
    .from(setQuestionLinksTable).where(eq(setQuestionLinksTable.setId, setId));
  const existingIds = new Set(existing.map(e => e.questionId));

  // Also skip questions owned by this set already
  const ownedQs = await db.select({ id: questionsTable.id }).from(questionsTable).where(eq(questionsTable.setId, setId));
  const ownedIds = new Set(ownedQs.map(q => q.id));

  const toLink = questionIds.filter(qId => !existingIds.has(qId) && !ownedIds.has(qId));
  if (toLink.length === 0) return res.json({ linked: 0 });

  const values = toLink.map(qId => ({ questionId: qId, setId, questionIndex: nextIndex++, hiddenParts: [] as string[] }));
  await db.insert(setQuestionLinksTable).values(values);
  await db.update(questionSetsTable)
    .set({ totalQuestions: sql`${questionSetsTable.totalQuestions} + ${toLink.length}` })
    .where(eq(questionSetsTable.id, setId));

  return res.json({ linked: toLink.length });
});

router.delete("/links/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const [link] = await db.select({ id: setQuestionLinksTable.id, setId: setQuestionLinksTable.setId }).from(setQuestionLinksTable).where(eq(setQuestionLinksTable.id, id)).limit(1);
  if (!link) return res.status(404).json({ error: "Link not found" });
  await db.delete(setQuestionLinksTable).where(eq(setQuestionLinksTable.id, id));
  await db.update(questionSetsTable)
    .set({ totalQuestions: sql`GREATEST(${questionSetsTable.totalQuestions} - 1, 0)` })
    .where(eq(questionSetsTable.id, link.setId));
  return res.status(204).send();
});

router.patch("/links/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const [link] = await db.select().from(setQuestionLinksTable).where(eq(setQuestionLinksTable.id, id)).limit(1);
  if (!link) return res.status(404).json({ error: "Link not found" });
  const hiddenParts: string[] = Array.isArray(req.body?.hiddenParts) ? req.body.hiddenParts : link.hiddenParts;
  const [updated] = await db.update(setQuestionLinksTable).set({ hiddenParts }).where(eq(setQuestionLinksTable.id, id)).returning();
  return res.json(updated);
});

export default router;
