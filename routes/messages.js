import express from "express";
import controller from "../controllers/users.js";
import middleware from "../middlewares/index.js";

const router = express.Router();

router.post(
  "/message",
  middleware.checkAuth,
  controller.sendMessage,
);

export default router