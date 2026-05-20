import { Router, type IRouter } from "express";
import { eq, isNull, sql, count } from "drizzle-orm";
import { db, foldersTable } from "@workspace/db";
import {
  ListFoldersQueryParams,
  CreateFolderBody,
  GetFolderParams,
  UpdateFolderParams,
  UpdateFolderBody,
  DeleteFolderParams,
  GetFolderBreadcrumbParams,
  ReorderFoldersBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const FOLDER_COLS = {
  id: foldersTable.id,
  name: foldersTable.name,
  parentId: foldersTable.parentId,
  color: foldersTable.color,
  icon: foldersTable.icon,
  style: foldersTable.style,
  position: foldersTable.position,
  createdAt: foldersTable.createdAt,
  childCount: sql<number>`(SELECT COUNT(*) FROM folders c WHERE c.parent_id = folders.id)::int`,
};

async function getFolderWithChildCount(id: number) {
  const [folder] = await db
    .select(FOLDER_COLS)
    .from(foldersTable)
    .where(eq(foldersTable.id, id));
  return folder;
}

async function isDescendantOf(ancestorId: number, targetId: number): Promise<boolean> {
  const children = await db.select({ id: foldersTable.id }).from(foldersTable).where(eq(foldersTable.parentId, ancestorId));
  for (const child of children) {
    if (child.id === targetId) return true;
    if (await isDescendantOf(child.id, targetId)) return true;
  }
  return false;
}

async function deleteDescendants(id: number): Promise<void> {
  const children = await db
    .select({ id: foldersTable.id })
    .from(foldersTable)
    .where(eq(foldersTable.parentId, id));
  for (const child of children) {
    await deleteDescendants(child.id);
  }
  await db.delete(foldersTable).where(eq(foldersTable.id, id));
}

router.get("/folders", async (req, res): Promise<void> => {
  const parsed = ListFoldersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { parentId, search, flat } = parsed.data;

  const rows = await db
    .select(FOLDER_COLS)
    .from(foldersTable)
    .where(
      flat
        ? undefined
        : parentId != null
          ? eq(foldersTable.parentId, parentId)
          : isNull(foldersTable.parentId)
    )
    .orderBy(foldersTable.position, foldersTable.createdAt);

  const filtered = search
    ? rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : rows;

  res.json(filtered);
});

router.post("/folders", async (req, res): Promise<void> => {
  const parsed = CreateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const COLORS = [
    "#6366f1", "#f59e0b", "#ef4444", "#10b981",
    "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
  ];

  const { name, parentId, color, icon, style } = parsed.data;
  const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];

  const [maxPos] = await db
    .select({ max: sql<number>`COALESCE(MAX(position), 0)` })
    .from(foldersTable)
    .where(parentId != null ? eq(foldersTable.parentId, parentId) : isNull(foldersTable.parentId));

  const [folder] = await db
    .insert(foldersTable)
    .values({
      name,
      parentId: parentId ?? null,
      color: color ?? randomColor,
      icon: icon ?? "folder",
      style: style ?? "default",
      position: (maxPos.max ?? 0) + 1,
    })
    .returning();

  const withCount = await getFolderWithChildCount(folder.id);
  res.status(201).json(withCount);
});

router.get("/folders/stats", async (_req, res): Promise<void> => {
  const [totalResult] = await db.select({ count: count() }).from(foldersTable);
  const [rootResult] = await db.select({ count: count() }).from(foldersTable).where(isNull(foldersTable.parentId));

  const depthResult = await db.execute(sql`
    WITH RECURSIVE depth_cte AS (
      SELECT id, parent_id, 1 AS depth FROM folders WHERE parent_id IS NULL
      UNION ALL
      SELECT f.id, f.parent_id, d.depth + 1 FROM folders f JOIN depth_cte d ON f.parent_id = d.id
    )
    SELECT COALESCE(MAX(depth), 0) AS max_depth FROM depth_cte
  `);

  const maxDepth = Number((depthResult.rows[0] as { max_depth: number }).max_depth ?? 0);

  res.json({
    totalFolders: totalResult.count,
    rootFolders: rootResult.count,
    maxDepth,
  });
});

router.post("/folders/reorder", async (req, res): Promise<void> => {
  const parsed = ReorderFoldersBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  for (const { id, position } of parsed.data.items) {
    await db.update(foldersTable).set({ position }).where(eq(foldersTable.id, id));
  }

  res.json({ ok: true });
});

router.get("/folders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetFolderParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const folder = await getFolderWithChildCount(params.data.id);
  if (!folder) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  res.json(folder);
});

router.patch("/folders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateFolderParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateFolderBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updates: Partial<{ name: string; color: string; icon: string; style: string; parentId: number | null }> = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.color !== undefined) updates.color = body.data.color;
  if (body.data.icon !== undefined) updates.icon = body.data.icon;
  if (body.data.style !== undefined) updates.style = body.data.style;
  if ("parentId" in body.data) {
    const newParentId = body.data.parentId ?? null;
    // Cycle check: cannot move into itself or a descendant
    if (newParentId === params.data.id) {
      res.status(400).json({ error: "Cannot move a folder into itself" });
      return;
    }
    if (newParentId != null) {
      const isDesc = await isDescendantOf(params.data.id, newParentId);
      if (isDesc) {
        res.status(400).json({ error: "Cannot move a folder into its own descendant" });
        return;
      }
    }
    updates.parentId = newParentId;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(foldersTable)
    .set(updates)
    .where(eq(foldersTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  const withCount = await getFolderWithChildCount(updated.id);
  res.json(withCount);
});

router.delete("/folders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteFolderParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db.select({ id: foldersTable.id }).from(foldersTable).where(eq(foldersTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  await deleteDescendants(params.data.id);
  res.sendStatus(204);
});

router.get("/folders/:id/breadcrumb", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetFolderBreadcrumbParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await db.execute(sql`
    WITH RECURSIVE breadcrumb_cte AS (
      SELECT id, name, parent_id FROM folders WHERE id = ${params.data.id}
      UNION ALL
      SELECT f.id, f.name, f.parent_id FROM folders f JOIN breadcrumb_cte b ON f.id = b.parent_id
    )
    SELECT id, name FROM breadcrumb_cte ORDER BY id ASC
  `);

  if (result.rows.length === 0) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  res.json(result.rows);
});

export default router;
