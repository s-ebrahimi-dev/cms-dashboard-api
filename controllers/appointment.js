
import mongoose from "mongoose";
import { Temporal } from "@js-temporal/polyfill";

import UserModel from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import Service from "../models/Service.js";
import Appointment from "../models/Appointment.js";
import WorkshopSettings from "../models/WorkshopSettings.js";


import {
  ACTIVE_STATUSES,
  getMaximumConcurrentCount,
} from "../utils/appointmentAvailability.js";

// --------------------------------------------------
// Shared helpers
// --------------------------------------------------

const parseClockTime = (value) => {
  if (
    typeof value !== "string" ||
    !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)
  ) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const getWorkshopSettings = async () => {
  const settings = await WorkshopSettings.findOne();

  if (!settings) {
    return { error: "Workshop settings have not been configured." };
  }

  const openingMinutes = parseClockTime(settings.openingTime);
  const closingMinutes = parseClockTime(settings.closingTime);

  if (
    openingMinutes === null ||
    closingMinutes === null ||
    openingMinutes >= closingMinutes ||
    !Number.isInteger(settings.maxConcurrentVehicles) ||
    settings.maxConcurrentVehicles < 1 ||
    !Number.isInteger(settings.slotIntervalMinutes) ||
    settings.slotIntervalMinutes < 5
  ) {
    return { error: "Workshop settings are invalid." };
  }

  try {
    Temporal.Now.zonedDateTimeISO(settings.timezone);
  } catch {
    return { error: "The workshop timezone is invalid." };
  }

  return { settings, openingMinutes, closingMinutes };
};

const getOverlappingAppointments = (start, end, session) => {
  let query = Appointment.find({
    status: { $in: ACTIVE_STATUSES },
    scheduledAt: { $lt: end },
    scheduledEndAt: { $gt: start },
  }).select("service scheduledAt scheduledEndAt status");

  if (session) {
    query = query.session(session);
  }

  return query;
};

const checkBookingCapacity = ({
  service,
  start,
  end,
  appointments,
  workshopCapacity,
}) => {
  if (
    !Number.isInteger(service.maxConcurrentBookings) ||
    service.maxConcurrentBookings < 1
  ) {
    return {
      available: false,
      status: 500,
      message: "The service booking capacity is not configured correctly.",
    };
  }

  const serviceAppointments = appointments.filter(
    (appointment) =>
      appointment.service.toString() === service._id.toString(),
  );

  const serviceMaximum = getMaximumConcurrentCount(
    serviceAppointments,
    start,
    end,
  );

  const workshopMaximum = getMaximumConcurrentCount(
    appointments,
    start,
    end,
  );

  if (serviceMaximum > service.maxConcurrentBookings) {
    return {
      available: false,
      status: 409,
      message: "This service has reached its booking capacity.",
    };
  }

  if (workshopMaximum > workshopCapacity) {
    return {
      available: false,
      status: 409,
      message: "The workshop has reached its vehicle capacity.",
    };
  }

  return { available: true };
};

const parseWorkshopDateTime = (date, time, timezone) => {
  try {
    return Temporal.PlainDateTime.from(
      `${date}T${time}`,
    ).toZonedDateTime(timezone, {
      disambiguation: "reject",
    });
  } catch {
    return null;
  }
};

// --------------------------------------------------
// POST /api/appointments
// Register an appointment
// --------------------------------------------------
const isTransientTransactionError = (error) =>
  error?.hasErrorLabel?.("TransientTransactionError") ||
  error?.hasErrorLabel?.("UnknownTransactionCommitResult");
const createAppointment = async (req, res) => {
  try {
    if (req.user?.role !== "RECEPTIONIST") {
      return res.status(403).json({
        message: "Only receptionists can register appointments.",
      });
    }

    const { customer, vehicle, service, scheduledAt, notes } =
      req.body || {};

    if (
      notes !== undefined &&
      notes !== null &&
      typeof notes !== "string"
    ) {
      return res.status(400).json({
        message: "Notes must be a string.",
      });
    }

    if (typeof notes === "string" && notes.length > 2000) {
      return res.status(400).json({
        message: "Notes cannot exceed 2000 characters.",
      });
    }

    if (!customer || !vehicle || !service || !scheduledAt) {
      return res.status(400).json({
        message:
          "Customer, vehicle, service, and appointment date are required.",
      });
    }

    for (const [field, id] of [
      ["customer", customer],
      ["vehicle", vehicle],
      ["service", service],
    ]) {
      if (
        typeof id !== "string" ||
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return res.status(400).json({
          message: `Invalid ${field} ID.`,
        });
      }
    }

    // Require an ISO timestamp containing a timezone.
    if (
      typeof scheduledAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        scheduledAt,
      )
    ) {
      return res.status(400).json({
        message:
          "scheduledAt must be an ISO timestamp with a timezone.",
      });
    }

    const appointmentDate = new Date(scheduledAt);

    if (Number.isNaN(appointmentDate.getTime())) {
      return res.status(400).json({
        message: "Invalid appointment date.",
      });
    }

    if (appointmentDate <= new Date()) {
      return res.status(400).json({
        message: "The appointment must be scheduled in the future.",
      });
    }

    const customerUser = await UserModel.findOne({
      _id: customer,
      role: "CUSTOMER",
    }).select("_id");

    if (!customerUser) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    const customerVehicle = await Vehicle.findOne({
      _id: vehicle,
      customer: customerUser._id,
    }).select("_id");

    if (!customerVehicle) {
      return res.status(400).json({
        message: "The selected vehicle does not belong to this customer.",
      });
    }

    const selectedService = await Service.findOne({
      _id: service,
      isActive: true,
    }).select(
      "name category basePrice estimatedDurationMinutes maxConcurrentBookings",
    );

    if (!selectedService) {
      return res.status(404).json({
        message: "Active service not found.",
      });
    }

    const duration = selectedService.estimatedDurationMinutes;

    if (
      !Number.isInteger(duration) ||
      duration < 1 ||
      !Number.isFinite(selectedService.basePrice) ||
      selectedService.basePrice < 0 ||
      !Number.isInteger(selectedService.maxConcurrentBookings) ||
      selectedService.maxConcurrentBookings < 1
    ) {
      return res.status(500).json({
        message: "The selected service has invalid configuration.",
      });
    }

    const workshop = await getWorkshopSettings();

    if (workshop.error) {
      return res.status(500).json({
        message: workshop.error,
      });
    }

    const { settings, openingMinutes, closingMinutes } = workshop;

    // Convert the submitted instant to the workshop's local date and time.
    const localDateTime = Temporal.Instant.from(
      appointmentDate.toISOString(),
    ).toZonedDateTimeISO(settings.timezone);

    const preferredDate = localDateTime.toPlainDate().toString();

    const hours = localDateTime.hour;
    const minutes = localDateTime.minute;

    const localTime =
      `${String(hours).padStart(2, "0")}:` +
      `${String(minutes).padStart(2, "0")}`;

    // Reject timestamps that cannot represent a valid workshop-local time.
    const validatedLocalTime = parseWorkshopDateTime(
      preferredDate,
      localTime,
      settings.timezone,
    );

    if (
      !validatedLocalTime ||
      validatedLocalTime.epochMilliseconds !== appointmentDate.getTime()
    ) {
      return res.status(400).json({
        message: "The selected appointment time is invalid.",
      });
    }

    const selectedStartMinutes = hours * 60 + minutes;

    // The start must be on the configured slot interval.
    const alignsWithSlotInterval =
      (selectedStartMinutes - openingMinutes) %
        settings.slotIntervalMinutes ===
      0;

    if (
      selectedStartMinutes < openingMinutes ||
      selectedStartMinutes + duration > closingMinutes ||
      !alignsWithSlotInterval
    ) {
      return res.status(409).json({
        message:
          "The selected time is not a valid appointment slot.",
      });
    }

    const scheduledStart = appointmentDate;
    const scheduledEnd = new Date(
      scheduledStart.getTime() + duration * 60_000,
    );

    const session = await mongoose.startSession();
    let createdAppointment;

    try {
      await session.withTransaction(async () => {
        // Acquire the same workshop-document lock used by the scheduler.
        // Concurrent booking transactions must contend on this document.
        const lockedSettings = await WorkshopSettings.findOneAndUpdate(
          { _id: settings._id },
          { $inc: { bookingLockVersion: 1 } },
          {
            new: true,
            session,
          },
        );

        if (!lockedSettings) {
          const error = new Error(
            "Workshop settings have not been configured.",
          );
          error.statusCode = 500;
          throw error;
        }

        // Recheck that the selected slot is still in the future.
        if (scheduledStart <= new Date()) {
          const error = new Error(
            "The selected appointment time is no longer in the future.",
          );
          error.statusCode = 409;
          throw error;
        }

        // Read overlapping bookings inside the same transaction.
        const overlappingAppointments =
          await getOverlappingAppointments(
            scheduledStart,
            scheduledEnd,
            session,
          );

        // Include the proposed appointment when calculating concurrency.
        const capacity = checkBookingCapacity({
          service: selectedService,
          start: scheduledStart,
          end: scheduledEnd,
          appointments: overlappingAppointments,
          workshopCapacity: lockedSettings.maxConcurrentVehicles,
        });

        if (!capacity.available) {
          const error = new Error(capacity.message);
          error.statusCode = capacity.status;
          throw error;
        }

        const [appointment] = await Appointment.create(
          [
            {
              customer: customerUser._id,
              vehicle: customerVehicle._id,
              service: selectedService._id,
              receptionist: req.user._id,
              createdBy: req.user._id,
              assignedTechnician: null,
              scheduledAt: scheduledStart,
              scheduledEndAt: scheduledEnd,
              servicePrice: selectedService.basePrice,
              estimatedDurationMinutes: duration,
              notes: typeof notes === "string" ? notes.trim() : "",
            },
          ],
          { session },
        );

        createdAppointment = appointment;
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          message: error.message,
        });
      }

      throw error;
    } finally {
      await session.endSession();
    }

    if (!createdAppointment) {
      return res.status(500).json({
        message: "The appointment could not be created.",
      });
    }

    const populatedAppointment = await Appointment.findById(
      createdAppointment._id,
    )
      .populate("customer", "firstname lastname username email phone")
      .populate(
        "vehicle",
        "make model year licensePlate mileage color",
      )
      .populate("service", "name category basePrice")
      .populate("receptionist", "firstname lastname username role")
      .populate(
        "assignedTechnician",
        "firstname lastname username role",
      )
      .lean();

    return res.status(201).json({
      data: populatedAppointment,
      message: "Appointment created successfully.",
    });
  } catch (error) {
    console.error("CREATE APPOINTMENT ERROR:", error);

    return res.status(500).json({
      message: "Failed to create appointment.",
    });
  }
};

// --------------------------------------------------
// GET /api/appointments/availability
// Get available slots for a service and date
// --------------------------------------------------

const getAvailableSlots = async (req, res) => {
  try {
    const { serviceId, date } = req.query;

    if (
      typeof serviceId !== "string" ||
      !mongoose.Types.ObjectId.isValid(serviceId)
    ) {
      return res.status(400).json({
        message: "A valid serviceId is required.",
      });
    }

    if (typeof date !== "string") {
      return res.status(400).json({
        message: "Date must use YYYY-MM-DD format.",
      });
    }

    let requestedDate;

    try {
      requestedDate = Temporal.PlainDate.from(date);

      if (requestedDate.toString() !== date) {
        throw new Error("Invalid date.");
      }
    } catch {
      return res.status(400).json({
        message: "Provide a valid date in YYYY-MM-DD format.",
      });
    }

    const selectedService = await Service.findOne({
      _id: serviceId,
      isActive: true,
    }).select(
      "name basePrice estimatedDurationMinutes maxConcurrentBookings",
    );

    if (!selectedService) {
      return res.status(404).json({
        message: "Active service not found.",
      });
    }

    const duration = selectedService.estimatedDurationMinutes;

    if (
      !Number.isInteger(duration) ||
      duration < 1 ||
      !Number.isInteger(selectedService.maxConcurrentBookings) ||
      selectedService.maxConcurrentBookings < 1
    ) {
      return res.status(500).json({
        message: "The selected service has invalid configuration.",
      });
    }

    const workshop = await getWorkshopSettings();

    if (workshop.error) {
      return res.status(500).json({ message: workshop.error });
    }

    const { settings, openingMinutes, closingMinutes } = workshop;

    const startOfDay = parseWorkshopDateTime(
      requestedDate.toString(),
      "00:00",
      settings.timezone,
    );

    const nextDate = requestedDate.add({ days: 1 });

    const startOfNextDay = parseWorkshopDateTime(
      nextDate.toString(),
      "00:00",
      settings.timezone,
    );

    if (!startOfDay || !startOfNextDay) {
      return res.status(400).json({
        message: "Unable to interpret this date in the workshop timezone.",
      });
    }

    const dayStart = new Date(startOfDay.epochMilliseconds);
    const dayEnd = new Date(startOfNextDay.epochMilliseconds);

    const appointments = await getOverlappingAppointments(
      dayStart,
      dayEnd,
    );

    const now = Date.now();
    const slots = [];

    for (
      let minuteOfDay = openingMinutes;
      minuteOfDay + duration <= closingMinutes;
      minuteOfDay += settings.slotIntervalMinutes
    ) {
      const hours = Math.floor(minuteOfDay / 60);
      const minutes = minuteOfDay % 60;

      const localTime =
        `${String(hours).padStart(2, "0")}:` +
        `${String(minutes).padStart(2, "0")}`;

      const localSlot = parseWorkshopDateTime(
        requestedDate.toString(),
        localTime,
        settings.timezone,
      );

      // Skip nonexistent or ambiguous local times during DST transitions.
      if (!localSlot) {
        continue;
      }

      const candidateStart = new Date(localSlot.epochMilliseconds);
      const candidateEnd = new Date(
        candidateStart.getTime() + duration * 60_000,
      );

      if (candidateStart.getTime() <= now) {
        continue;
      }

      const overlappingAppointments = appointments.filter(
        (appointment) =>
          appointment.scheduledAt < candidateEnd &&
          appointment.scheduledEndAt > candidateStart,
      );

      const capacity = checkBookingCapacity({
        service: selectedService,
        start: candidateStart,
        end: candidateEnd,
        appointments: overlappingAppointments,
        workshopCapacity: settings.maxConcurrentVehicles,
      });

      if (capacity.available) {
        slots.push({
          start: candidateStart.toISOString(),
          end: candidateEnd.toISOString(),
        });
      }
    }

    return res.status(200).json({
      data: slots,
      message: "Available appointment slots retrieved.",
    });
  } catch (error) {
    console.error("GET AVAILABLE SLOTS ERROR:", error);

    return res.status(500).json({
      message: "Failed to retrieve available slots.",
    });
  }
};

const TECHNICIAN_ROLES = [
  "MECHANIC",
  "OIL_TECHNICIAN",
  "BODY_REPAIR",
  "DETAILING_TECHNICIAN",
  "WASH_TECHNICIAN",
];

// --------------------------------------------------
// PATCH /api/appointments/:id/start
// Start an assigned appointment
// --------------------------------------------------
const startAppointment = async (req, res) => {
  try {
    if (!TECHNICIAN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({
        message: "Only technicians can start appointments.",
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid appointment ID.",
      });
    }

    const startedAt = new Date();

    // Atomic transition: only a confirmed appointment assigned
    // to this technician can be started.
    const appointment = await Appointment.findOneAndUpdate(
      {
        _id: id,
        assignedTechnician: req.user._id,
        status: "CONFIRMED",
        startedAt: null,
        completedAt: null,
      },
      {
        $set: {
          status: "IN_PROGRESS",
          startedAt,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!appointment) {
      const existingAppointment = await Appointment.findById(id)
        .select("assignedTechnician status");

      if (!existingAppointment) {
        return res.status(404).json({
          message: "Appointment not found.",
        });
      }

      if (
        String(existingAppointment.assignedTechnician) !==
        String(req.user._id)
      ) {
        return res.status(403).json({
          message: "This appointment is not assigned to you.",
        });
      }

      return res.status(409).json({
        message:
          "This appointment cannot be started in its current state.",
      });
    }

    return res.status(200).json({
      data: appointment,
      message: "Appointment started successfully.",
    });
  } catch (error) {
    console.error("START APPOINTMENT ERROR:", error);

    return res.status(500).json({
      message: "Failed to start appointment.",
    });
  }
};

// --------------------------------------------------
// PATCH /api/appointments/:id/complete
// Complete an appointment
// --------------------------------------------------
const completeAppointment = async (req, res) => {
  try {
    if (!TECHNICIAN_ROLES.includes(req.user?.role)) {
      return res.status(403).json({
        message: "Only technicians can complete appointments.",
      });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid appointment ID.",
      });
    }

    const completedAt = new Date();

    // Read the start time so we can calculate actual duration.
    const existingAppointment = await Appointment.findOne({
      _id: id,
      assignedTechnician: req.user._id,
      status: "IN_PROGRESS",
      startedAt: { $type: "date" },
      completedAt: null,
    }).select("startedAt");

    if (!existingAppointment) {
      const appointment = await Appointment.findById(id)
        .select("assignedTechnician status");

      if (!appointment) {
        return res.status(404).json({
          message: "Appointment not found.",
        });
      }

      if (String(appointment.assignedTechnician) !== String(req.user._id)) {
        return res.status(403).json({
          message: "This appointment is not assigned to you.",
        });
      }

      return res.status(409).json({
        message:
          "Only an appointment in progress can be completed.",
      });
    }

    const startedAt = existingAppointment.startedAt;

    if (completedAt <= startedAt) {
      return res.status(409).json({
        message: "The completion time must be after the start time.",
      });
    }

    const actualDurationMinutes = Math.ceil(
      (completedAt.getTime() - startedAt.getTime()) / 60_000,
    );

    // Recheck the current state in the update itself. This prevents
    // a second concurrent completion request from succeeding.
    const completedAppointment = await Appointment.findOneAndUpdate(
      {
        _id: id,
        assignedTechnician: req.user._id,
        status: "IN_PROGRESS",
        startedAt,
        completedAt: null,
      },
      {
        $set: {
          status: "COMPLETED",
          completedAt,
          actualDurationMinutes,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!completedAppointment) {
      return res.status(409).json({
        message:
          "The appointment changed before it could be completed. Refresh and try again.",
      });
    }

    return res.status(200).json({
      data: completedAppointment,
      message: "Appointment completed successfully.",
    });
  } catch (error) {
    console.error("COMPLETE APPOINTMENT ERROR:", error);

    return res.status(500).json({
      message: "Failed to complete appointment.",
    });
  }
};

export default {
  createAppointment,
  getAvailableSlots,
  startAppointment,
  completeAppointment,
};
