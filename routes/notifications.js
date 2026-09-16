import express from "express";

import controller from "../controllers/notifications.js";
import middleware from "../middlewares/index.js";

const router = express.Router();

router.get(
  "/",
  middleware.checkAuth,
  controller.getNotifications,
);

export default router;