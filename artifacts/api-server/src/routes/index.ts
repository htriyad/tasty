import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import foldersRouter from "./folders";
import questionSetsRouter from "./questionSets";
import chorchaRouter from "./chorcha";
import migrateRouter from "./migrate";
import battleRouter from "./battle";
import savedRouter from "./saved";

const ADMIN_KEY = "HTR-CHORCHA-ADMIN-2025";
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const PUBLIC_POST_PREFIXES = [
  "/mock-exam/generate",
  "/saved",
];

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING.has(req.method)) { next(); return; }
  if (PUBLIC_POST_PREFIXES.some(p => req.path.startsWith(p))) { next(); return; }
  const key = req.headers["x-admin-key"];
  if (key !== ADMIN_KEY) {
    res.status(401).json({ error: "Admin access required" });
    return;
  }
  next();
}

const router: IRouter = Router();

router.use(requireAdmin);
router.use(healthRouter);
router.use(foldersRouter);
router.use(questionSetsRouter);
router.use(chorchaRouter);
router.use(migrateRouter);
router.use(battleRouter);
router.use(savedRouter);

export default router;
