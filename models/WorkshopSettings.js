import mongoose from "mongoose";

const workshopSettingsSchema = new mongoose.Schema(
  {
    maxConcurrentVehicles: {
      type: Number,
      required: true,
      min: 1,
      default: 10,
      validate: {
        validator: Number.isInteger,
        message: "Maximum concurrent vehicles must be a whole number.",
      },
    },

    openingTime: {
      type: String,
      required: true,
      default: "09:00",
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
    },

    closingTime: {
      type: String,
      required: true,
      default: "17:00",
      match: /^([01]\d|2[0-3]):[0-5]\d$/,
      validate: {
        validator(value) {
          return /^\d{2}:\d{2}$/.test(value) && value > this.openingTime;
        },
        message: "Closing time must be later than opening time.",
      },
    },

    slotIntervalMinutes: {
      type: Number,
      required: true,
      min: 5,
      default: 30,
      validate: {
        validator: Number.isInteger,
        message: "Slot interval must be a whole number of minutes.",
      },
    },
    bookingLockVersion: {
      type: Number,
      default: 0,
    },

    timezone: {
      type: String,
      required: true,
      default: "Asia/Tehran",
      validate: {
        validator(value) {
          try {
            new Intl.DateTimeFormat("en-US", {
              timeZone: value,
            });
            return true;
          } catch {
            return false;
          }
        },
        message: "Please provide a valid timezone identifier.",
      },
    },
  },
  { timestamps: true },
);

const WorkshopSettings = mongoose.model(
  "WorkshopSettings",
  workshopSettingsSchema,
);

export default WorkshopSettings;
