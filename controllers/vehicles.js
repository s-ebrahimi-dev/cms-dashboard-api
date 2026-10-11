
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

export default { getCustomerVehicles };
