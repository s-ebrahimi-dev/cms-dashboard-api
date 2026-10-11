
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

const getOverlappingAppointments = (start, end) =>
  Appointment.find({
    status: { $in: ACTIVE_STATUSES },
    scheduledAt: { $lt: end },
    scheduledEndAt: { $gt: start },
  }).select("service scheduledAt scheduledEndAt status");

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

    // Require a timezone-aware ISO timestamp from the client.
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
      selectedService.basePrice < 0
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

    // Check the requested instant against workshop-local opening hours.
    const localStart = Temporal.Instant.from(
      appointmentDate.toISOString(),
    ).toZonedDateTimeISO(settings.timezone);

    const startMinute = localStart.hour * 60 + localStart.minute;

    if (
      localStart.second !== 0 ||
      localStart.millisecond !== 0 ||
      startMinute < openingMinutes ||
      startMinute + duration > closingMinutes ||
      (startMinute - openingMinutes) % settings.slotIntervalMinutes !== 0
    ) {
      return res.status(400).json({
        message:
          "The selected time is outside opening hours or does not match the booking interval.",
      });
    }

    const scheduledEndAt = new Date(
      appointmentDate.getTime() + duration * 60_000,
    );

    const overlappingAppointments = await getOverlappingAppointments(
      appointmentDate,
      scheduledEndAt,
    );

    const capacity = checkBookingCapacity({
      service: selectedService,
      start: appointmentDate,
      end: scheduledEndAt,
      appointments: overlappingAppointments,
      workshopCapacity: settings.maxConcurrentVehicles,
    });

    if (!capacity.available) {
      return res.status(capacity.status).json({
        message: capacity.message,
      });
    }

    const appointment = await Appointment.create({
      customer: customerUser._id,
      vehicle: customerVehicle._id,
      service: selectedService._id,
      receptionist: req.user._id,
      assignedTechnician: null,
      scheduledAt: appointmentDate,
      scheduledEndAt,
      servicePrice: selectedService.basePrice,
      estimatedDurationMinutes: duration,
      notes: typeof notes === "string" ? notes.trim() : "",
    });

    const populatedAppointment = await Appointment.findById(
      appointment._id,
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

export default {
  createAppointment,
  getAvailableSlots,
};
