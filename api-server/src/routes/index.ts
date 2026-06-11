import { Router, type IRouter } from "express";
import healthRouter from "./health";
import casesRouter from "./cases";
import trialsRouter from "./trials";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(casesRouter);
router.use(trialsRouter);
router.use(dashboardRouter);

export default router;
