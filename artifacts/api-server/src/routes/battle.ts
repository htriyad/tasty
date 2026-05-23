import { Router, type IRouter } from "express";

// Battle is handled via Socket.IO (see src/battle/socketHandlers.ts + src/index.ts).
// This stub exists so routes/index.ts can import it without a build error.
// Add REST battle endpoints here in the future if needed.
const router: IRouter = Router();

export default router;
