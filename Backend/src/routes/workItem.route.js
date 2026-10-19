import express from "express";

export const workItemRouter = express.Router();
import * as workItemController from "../controllers/item.controller.js";
import * as activityController from "../controllers/activity.controller.js";
import * as authMiddleware from "../middlewares/auth.middleware.js"
import {idempotencyMiddleware} from "../middlewares/idempotency.js"
import requirePermission from "../middlewares/require.permission.js";

workItemRouter.get("/", authMiddleware.authUser, workItemController.listItems);
workItemRouter.get("/summary", authMiddleware.authUser, workItemController.summary);
workItemRouter.post("/", authMiddleware.authUser, idempotencyMiddleware, workItemController.itemController)

workItemRouter.get(
  "/:id/timeline",
  authMiddleware.authUser,
  requirePermission("item:view"),
  activityController.getItemTimeline,
);

workItemRouter.get("/:id", authMiddleware.authUser, requirePermission("item:view"), workItemController.getItem);



workItemRouter.patch("/:id", workItemController.updateItemController);

workItemRouter.post("/:id/claim", authMiddleware.authUser,
  requirePermission("item:claim"), workItemController.claimItemController);

workItemRouter.post(
  "/:id/status",
  authMiddleware.authUser,
  requirePermission("item:claim"),
  workItemController.changeStatusController,
);

workItemRouter.post(
  "/:id/priority",
  workItemController.changePriorityController,
);
