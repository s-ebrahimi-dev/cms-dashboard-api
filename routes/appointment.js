import express from "express";

import appointmentController from "../controllers/appointment.js";
import middleware from "../middlewares/index.js";

const router = express.Router();

// Get available appointment slots for a selected service and date.
router.get(
  "/availability",
  middleware.checkAuth,
  middleware.checkRole("RECEPTIONIST"),
  appointmentController.getAvailableSlots,
);

// Register a new appointment.
router.post(
  "/",
  middleware.checkAuth,
  middleware.checkRole("RECEPTIONIST"),
  appointmentController.createAppointment,
);

export default router;