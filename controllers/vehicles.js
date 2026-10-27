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
    const data = vehicles.map((vehicle) => {
      const item = vehicle.toObject();

      item.hasVehicleImage = Boolean(item.vehicleImage?.data);
      delete item.vehicleImage;

      return item;
    });
    return res.status(200).json({
      data,
      message: "Customer vehicles retrieved successfully.",
    });
  } catch (error) {
    console.error("Failed to retrieve customer vehicles:", error);

    return res.status(500).json({
      message: "Failed to retrieve customer vehicles.",
    });
  }
};

const getAllVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find()
      .select("make model year licensePlate vin mileage color customer")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      data: vehicles,
      message: "Vehicles retrieved successfully.",
    });
  } catch (error) {
    console.error("Failed to retrieve all vehicles:", error);

    return res.status(500).json({
      message: "Failed to retrieve vehicles.",
    });
  }
};

const createVehicle = async (req, res) => {
  try {
    const { customer, make, model, year, licensePlate, vin, mileage, color } =
      req.body;

    // Determine the vehicle owner based on the authenticated role.
    const customerId = req.user.role === "CUSTOMER" ? req.user._id : customer;

    // Validate the customer ID.
    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({
        message: "A valid customer ID is required.",
      });
    }

    // Confirm that the customer exists.
    const existingCustomer = await UserModel.findOne({
      _id: customerId,
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
    if (
      error instanceof mongoose.Error.ValidationError ||
      error instanceof mongoose.Error.CastError
    ) {
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

const getMyVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({
      customer: req.user._id,
    })
      .select(
        "make model year licensePlate vin mileage color customer vehicleImage",
      )
      .sort({ createdAt: -1 });
    const data = vehicles.map((vehicle) => {
      const item = vehicle.toObject();

      item.hasVehicleImage = Boolean(item.vehicleImage?.data);
      delete item.vehicleImage;

      return item;
    });
    return res.status(200).json({
      data,
      message: "Your vehicles were retrieved successfully.",
    });
  } catch (error) {
    console.error("Failed to retrieve customer's vehicles:", error);

    return res.status(500).json({
      message: "Failed to retrieve your vehicles.",
    });
  }
};

const getVehicleImage = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id).select(
      "customer vehicleImage",
    );

    if (!vehicle) {
      return res.status(404).json({
        message: "Vehicle not found.",
      });
    }

    // Customers can access only their own vehicle images.
    if (
      req.user.role === "CUSTOMER" &&
      vehicle.customer.toString() !== req.user._id.toString()
    ) {
      return res.status(404).end();
    }

    if (!vehicle.vehicleImage?.data) {
      return res.status(404).end();
    }

    res.set("Content-Type", vehicle.vehicleImage.contentType);
    res.set("Cache-Control", "private, max-age=3600");

    return res.send(vehicle.vehicleImage.data);
  } catch (error) {
    console.error("GET VEHICLE IMAGE ERROR:", error);

    return res.status(500).json({
      message: "Failed to load vehicle image.",
    });
  }
};

export default {
  getCustomerVehicles,
  getAllVehicles,
  createVehicle,
  getMyVehicles,
  getVehicleImage,
};
