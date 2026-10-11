import {Temporal} from "@js-temporal/polyfill";
import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import Service from "../models/Service.js";
import WorkshopSettings from "../models/WorkshopSettings.js";

import {
  ACTIVE_STATUSES,
  getMaximumConcurrentCount,
} from "./appointmentAvailability.js";

const MAX_SEARCH_DAYS = 90;

const parseClockTime = (value) => {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const getSettings = async (session) => {
  let query = WorkshopSettings.findOne();

  if (session) query = query.session(session);

  const settings = await query;

  if (!settings) {
    throw new Error("Workshop settings have not been configured.");
  }

  const openingMinutes = parseClockTime(settings.openingTime);
  const closingMinutes = parseClockTime(settings.closingTime);

  if (
    openingMinutes === null ||
    closingMinutes === null ||
    closingMinutes <= openingMinutes ||
    !Number.isInteger(settings.maxConcurrentVehicles) ||
    settings.maxConcurrentVehicles < 1 ||
    !Number.isInteger(settings.slotIntervalMinutes) ||
    settings.slotIntervalMinutes < 5 ||
    !settings.timezone
  ) {
    throw new Error("Workshop scheduling settings are invalid.");
  }

  return { settings, openingMinutes, closingMinutes };
};

const toZonedDateTime = (date, time, timezone) => {
  try {
    return Temporal.PlainDateTime.from(`${date}T${time}`).toZonedDateTime(
      timezone,
      { disambiguation: "reject" },
    );
  } catch {
    // A local time may be ambiguous or nonexistent during a timezone change.
    return null;
  }
};

const getPlainDate = (value, fieldName) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format.`);
  }

  try {
    return Temporal.PlainDate.from(value);
  } catch {
    throw new Error(`${fieldName} is not a valid calendar date.`);
  }
};

const getBookingCapacity = ({
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
    throw new Error("The service booking capacity is invalid.");
  }

  const serviceAppointments = appointments.filter(
    (appointment) => String(appointment.service) === String(service._id),
  );

  const serviceMaximum = getMaximumConcurrentCount(
    serviceAppointments,
    start,
    end,
  );

  const workshopMaximum = getMaximumConcurrentCount(appointments, start, end);

  return (
    serviceMaximum <= service.maxConcurrentBookings &&
    workshopMaximum <= workshopCapacity
  );
};

/**
 * @param {object} options
 * @param {mongoose.Types.ObjectId | string} options.serviceId
 * @param {string} [options.fromDate]
 * @param {string} [options.toDate]
 * @param {import("mongoose").ClientSession} options.session
 * @param {boolean} [options.lock]
 */
const findEarliestAvailableSlot = async ({
  serviceId,
  fromDate,
  toDate,
  session,
  lock = true,
}) => {
  if (lock && !session) {
    throw new Error(
      "A MongoDB transaction session is required when scheduling a booking.",
    );
  }

  if (!serviceId) {
    throw new Error("A service ID is required.");
  }

  // Read the settings document to identify the shared coordination document.
  const initialSettings = await getSettings(session);

  let settings = initialSettings.settings;

  if (lock) {
    // All appointment-creation transactions must update this same document.
    // Competing transactions then conflict instead of both claiming capacity.
    const lockedSettings = await WorkshopSettings.findOneAndUpdate(
      { _id: settings._id },
      { $inc: { bookingLockVersion: 1 } },
      { new: true, session, runValidators: true },
    );

    if (!lockedSettings) {
      throw new Error("Could not acquire the workshop booking lock.");
    }

    settings = lockedSettings;
  }

  const { openingMinutes, closingMinutes } = await getSettings(session);

  let serviceQuery = Service.findOne({
    _id: serviceId,
    isActive: true,
  });

  if (session) serviceQuery = serviceQuery.session(session);

  const service = await serviceQuery.select(
    "name basePrice estimatedDurationMinutes maxConcurrentBookings",
  );

  if (!service) {
    throw new Error("The selected service does not exist or is inactive.");
  }

  const duration = service.estimatedDurationMinutes;

  if (!Number.isInteger(duration) || duration < 1) {
    throw new Error("The service duration is invalid.");
  }

  const today = Temporal.Now.plainDateISO(settings.timezone);

  const firstDate = fromDate ? getPlainDate(fromDate, "fromDate") : today;

  const lastDate = toDate
    ? getPlainDate(toDate, "toDate")
    : firstDate.add({ days: MAX_SEARCH_DAYS - 1 });

  if (Temporal.PlainDate.compare(lastDate, firstDate) < 0) {
    throw new Error("toDate cannot be earlier than fromDate.");
  }

  const rangeLength = firstDate.until(lastDate, {
    largestUnit: "days",
  }).days;

  if (rangeLength >= MAX_SEARCH_DAYS) {
    throw new Error(
      `The scheduling range cannot exceed ${MAX_SEARCH_DAYS} calendar days.`,
    );
  }

  // Convert the full local-date range into instants for the database query.
  const rangeStart = toZonedDateTime(
    firstDate.toString(),
    "00:00",
    settings.timezone,
  );

  const dayAfterLast = lastDate.add({ days: 1 });

  const rangeEnd = toZonedDateTime(
    dayAfterLast.toString(),
    "00:00",
    settings.timezone,
  );

  if (!rangeStart || !rangeEnd) {
    throw new Error("Could not calculate the workshop date range.");
  }

  let appointmentsQuery = Appointment.find({
    status: { $in: ACTIVE_STATUSES },
    scheduledAt: { $lt: new Date(rangeEnd.epochMilliseconds) },
    scheduledEndAt: { $gt: new Date(rangeStart.epochMilliseconds) },
  }).select("service scheduledAt scheduledEndAt status");

  if (session) appointmentsQuery = appointmentsQuery.session(session);

  const appointments = await appointmentsQuery;

  const now = Temporal.Now.instant();

  for (
    let date = firstDate;
    Temporal.PlainDate.compare(date, lastDate) <= 0;
    date = date.add({ days: 1 })
  ) {
    for (
      let minutes = openingMinutes;
      minutes + duration <= closingMinutes;
      minutes += settings.slotIntervalMinutes
    ) {
      const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
      const mins = String(minutes % 60).padStart(2, "0");

      const start = toZonedDateTime(
        date.toString(),
        `${hours}:${mins}`,
        settings.timezone,
      );

      if (!start || Temporal.Instant.compare(start.toInstant(), now) <= 0) {
        continue;
      }

      const end = start.add({ minutes: duration });

      // Do not allow a service to finish on a later local calendar day.
      if (end.toPlainDate().toString() !== date.toString()) {
        continue;
      }

      const endMinutes =
        end.hour * 60 +
        end.minute +
        (end.second > 0 || end.millisecond > 0 ? 1 : 0);

      if (endMinutes > closingMinutes) {
        continue;
      }

      const scheduledAt = new Date(start.epochMilliseconds);
      const scheduledEndAt = new Date(end.epochMilliseconds);

      const overlappingAppointments = appointments.filter(
        (appointment) =>
          new Date(appointment.scheduledAt) < scheduledEndAt &&
          new Date(appointment.scheduledEndAt) > scheduledAt,
      );

      const available = getBookingCapacity({
        service,
        start: scheduledAt,
        end: scheduledEndAt,
        appointments: overlappingAppointments,
        workshopCapacity: settings.maxConcurrentVehicles,
      });

      if (!available) continue;

      return {
        scheduledAt,
        scheduledEndAt,
        servicePrice: service.basePrice,
        estimatedDurationMinutes: duration,
        service,
      };
    }
  }

  return null;
};

export { findEarliestAvailableSlot };
