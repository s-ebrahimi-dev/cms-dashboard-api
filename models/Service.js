import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    category: {
      type: String,
      required: true,
      trim: true,
      enum: [
        "MAINTENANCE",
        "REPAIR",
        "INSPECTION",
        "DETAILING",
        "WASHING",
        "OTHER",
      ],
    },

    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    maxConcurrentBookings: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: "Maximum concurrent bookings must be a whole number.",
      },
    },
    estimatedDurationMinutes: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Estimated duration must be a whole number of minutes.",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

const Service = mongoose.model("Service", serviceSchema);

export default Service;
