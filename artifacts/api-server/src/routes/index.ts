import { Router, type IRouter } from "express";
import healthRouter from "./health";
import foldersRouter from "./folders";
import questionSetsRouter from "./questionSets";
import chorchaRouter from "./chorcha";

const router: IRouter = Router();

router.use(healthRouter);
router.use(foldersRouter);
router.use(questionSetsRouter);
router.use("/chorcha", chorchaRouter);

export default router;
