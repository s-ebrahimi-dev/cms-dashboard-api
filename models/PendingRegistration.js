
import mongoose from "mongoose";

const pendingRegistrationSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },

    lastname: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },

    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      match: /^[0-9]{11}$/,
    },

    // Already hashed with bcrypt before being stored here.
    password: {
      type: String,
      required: true,
      select: false,
    },

    // HMAC-SHA256 hash of the verification code.
    verificationCodeHash: {
      type: String,
      required: true,
      select: false,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastCodeSentAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// MongoDB eventually removes expired pending registrations.
// The verification controller must still check expiresAt explicitly.
pendingRegistrationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

const PendingRegistration = mongoose.model(
  "PendingRegistration",
  pendingRegistrationSchema,
);

export default PendingRegistration;
