import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    make: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    model: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    year: {
      type: Number,
      required: true,
      min: 1886,
      max: new Date().getFullYear() + 1,
      validate: {
        validator: Number.isInteger,
        message: "Vehicle year must be a whole number.",
      },
    },

    licensePlate: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },

    vin: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 17,
    },

    mileage: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: "Mileage must be a whole number.",
      },
    },

    color: {
      type: String,
      trim: true,
      maxlength: 30,
    },

    vehicleImage: {
      data: Buffer,
      contentType: String,
    },
  },
  {
    timestamps: true,
  },
);

const Vehicle = mongoose.model("Vehicle", vehicleSchema);

export default Vehicle;
