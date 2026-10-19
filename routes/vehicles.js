import express from "express";
import controller from "../controllers/vehicles.js";
import middleware from "../middlewares/index.js";

const router = express.Router();

router.get(
  "/",
  middleware.checkAuth,
  middleware.checkRole("RECEPTIONIST"),
  controller.getCustomerVehicles,
);

router.get(
  "/all",
  middleware.checkAuth,
  middleware.checkRole("ADMIN"),
  controller.getAllVehicles,
);

router.post(
  "/",
  middleware.checkAuth,
  middleware.checkRole("RECEPTIONIST"),
  controller.createVehicle,
);
export default router;
