import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gridoraRouter from "./gridora";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gridoraRouter);

export default router;
