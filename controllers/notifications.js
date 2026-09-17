import NotificationModel from "../models/Notifications.js";

const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

      const notifications = await NotificationModel.find({
  recipient: userId,
})
  .populate("sender", "username role")
  .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get notifications",
    });
  }
};

export default {
  getNotifications,
};