
import Service from "../models/Service.js";

const getActiveServices = async (req, res) => {
  try {
    const services = await Service.find({ isActive: true })
      .select(
  "name description category requiredTechnicianRole basePrice estimatedDurationMinutes maxConcurrentBookings",
)
      .sort({ name: 1 });

    return res.status(200).json({
      data: services,
      message: "Active services retrieved successfully.",
    });
  } catch (error) {
    console.error("Failed to retrieve active services:", error);

    return res.status(500).json({
      message: "Failed to retrieve active services.",
    });
  }
};

export default { getActiveServices };
