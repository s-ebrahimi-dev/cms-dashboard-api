import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true,
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    // The receptionist responsible for this appointment.
    // Customer-created requests may not have one yet.
    receptionist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // User who initiated the appointment: customer or receptionist.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Receptionist who accepted or rejected the request.
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    assignedTechnician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    scheduledAt: {
      type: Date,
      required: true,
    },

    scheduledEndAt: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return (
            this.scheduledAt instanceof Date &&
            !Number.isNaN(this.scheduledAt.getTime()) &&
            value instanceof Date &&
            !Number.isNaN(value.getTime()) &&
            value > this.scheduledAt
          );
        },
        message:
          "The scheduled end time must be after the scheduled start time.",
      },
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "REJECTED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "NO_SHOW",
      ],
      default: "PENDING",
      index: true,
    },

    servicePrice: {
      type: Number,
      required: true,
      min: 0,
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

    startedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    actualDurationMinutes: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator(value) {
          return value === null || Number.isInteger(value);
        },
        message: "Actual duration must be a whole number of minutes.",
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// General appointment scheduling and status queries.
appointmentSchema.index({ scheduledAt: 1, status: 1 });

// Technician scheduling queries.
appointmentSchema.index({
  assignedTechnician: 1,
  scheduledAt: 1,
});

// Receptionist review queue.
appointmentSchema.index({ status: 1, createdAt: 1 });

const Appointment = mongoose.model("Appointment", appointmentSchema);

export default Appointment;