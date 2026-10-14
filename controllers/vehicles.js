
import mongoose from "mongoose";
import UserModel from "../models/User.js";
import Vehicle from "../models/Vehicle.js";

const getCustomerVehicles = async (req, res) => {
  try {
    const { customerId } = req.query;

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({
        message: "A valid customer ID is required.",
      });
    }

    const customer = await UserModel.findOne({
      _id: customerId,
      role: "CUSTOMER",
    }).select("_id");

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    const vehicles = await Vehicle.find({
      customer: customer._id,
    })
      .select("make model year licensePlate vin mileage color customer")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      data: vehicles,
      message: "Customer vehicles retrieved successfully.",
    });
  } catch (error) {
    console.error("Failed to retrieve customer vehicles:", error);

    return res.status(500).json({
      message: "Failed to retrieve customer vehicles.",
    });
  }
};


import mongoose from "mongoose";
import UserModel from "../models/User.js";
import Vehicle from "../models/Vehicle.js";

const createVehicle = async (req, res) => {
  try {
    const {
      customer,
      make,
      model,
      year,
      licensePlate,
      vin,
      mileage,
      color,
    } = req.body;

    // Validate customer ID.
    if (
      typeof customer !== "string" ||
      !mongoose.Types.ObjectId.isValid(customer)
    ) {
      return res.status(400).json({
        message: "A valid customer ID is required.",
      });
    }

    // Confirm that the customer exists.
    const existingCustomer = await UserModel.findOne({
      _id: customer,
      role: "CUSTOMER",
    }).select("_id");

    if (!existingCustomer) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    // Validate required vehicle fields.
    if (
      typeof make !== "string" ||
      !make.trim() ||
      typeof model !== "string" ||
      !model.trim() ||
      typeof licensePlate !== "string" ||
      !licensePlate.trim() ||
      year === undefined ||
      year === "" ||
      mileage === undefined ||
      mileage === ""
    ) {
      return res.status(400).json({
        message: "Make, model, year, license plate, and mileage are required.",
      });
    }

    const vehicle = await Vehicle.create({
      customer: existingCustomer._id,
      make,
      model,
      year,
      licensePlate,
      vin,
      mileage,
      color,
    });

    return res.status(201).json({
      data: vehicle,
      message: "Vehicle created successfully.",
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError ||
        error instanceof mongoose.Error.CastError) {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error("Failed to create vehicle:", error);

    return res.status(500).json({
      message: "Failed to create vehicle.",
    });
  }
};



export default { getCustomerVehicles, createVehicle };
