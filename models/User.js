import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      required: true,
      default: undefined,
      validate: {
        validator: (coordinates) =>
          Array.isArray(coordinates) &&
          coordinates.length === 2 &&
          coordinates[0] >= -180 &&
          coordinates[0] <= 180 &&
          coordinates[1] >= -90 &&
          coordinates[1] <= 90,
        message:
          "Coordinates must contain valid longitude and latitude values.",
      },
    },
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    country: { type: String, trim: true },
    province: { type: String, trim: true },
    city: { type: String, trim: true },
    district: { type: String, trim: true },
    street: { type: String, trim: true },
    buildingNumber: { type: String, trim: true },
    unit: { type: String, trim: true },
    postalCode: { type: String, trim: true },

    location: {
      type: locationSchema,
      required: true,
    },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
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
      minlength: 3,
      lowercase: true,
      maxlength: 30,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: /^[0-9]{11}$/,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: [
        "ADMIN",
        "CUSTOMER",
        "RECEPTIONIST",
        "MECHANIC",
        "OIL_TECHNICIAN",
        "BODY_REPAIR",
        "DETAILING_TECHNICIAN",
        "WASH_TECHNICIAN",
      ],
      default: "CUSTOMER",
    },
    maxConcurrentVehicles: {
      type: Number,
      min: 1,
    },
    profileImage: {
      data: Buffer,
      contentType: String,
    },
    address: {
      type: addressSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);
const model = mongoose.model("User", schema);

export default model;
