import express from "express";

import controller from "../controllers/conversations.js";
import middleware from "../middlewares/index.js";

const router = express.Router();

router.get(
  "/",
  middleware.checkAuth,
  controller.getConversations,
);

router.post(
  "/",
  middleware.checkAuth,
  controller.createConversation,
);

router.get(
  "/:id/messages",
  middleware.checkAuth,
  controller.getMessages,
);

router.post(
  "/:id/messages",
  middleware.checkAuth,
  controller.sendMessage,
);

router.patch(
  "/messages/:id/read",
  middleware.checkAuth,
  controller.markMessageAsRead,
);

router.get(
  "/:id",
  middleware.checkAuth,
  controller.getConversation,
);

export default router;