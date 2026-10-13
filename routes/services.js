import express from "express";
import controller from "../controllers/services.js";
import middleware from "../middlewares/index.js";

const router = express.Router();

router.get(
  "/",
  middleware.checkAuth,
  middleware.checkRole("RECEPTIONIST"),
  controller.getActiveServices,
);

export default router;
