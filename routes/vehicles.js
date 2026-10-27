import express from "express";
import controller from "../controllers/vehicles.js";
import middleware from "../middlewares/index.js";

const router = express.Router();
router.get(
  "/mine",
  middleware.checkAuth,
  middleware.checkRole("CUSTOMER"),
  controller.getMyVehicles,
);

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
router.get(
  "/:id/image",
  middleware.checkAuth,
  middleware.checkRole("ADMIN", "RECEPTIONIST", "CUSTOMER"),
  controller.getVehicleImage,
);


router.post(
  "/",
  middleware.checkAuth,
  middleware.checkRole("RECEPTIONIST", "CUSTOMER"),
  controller.createVehicle,
);
export default router;
