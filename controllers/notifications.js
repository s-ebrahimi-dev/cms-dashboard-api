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

const markNotificationAsRead = async (req, res) => {
  try {
    const notification = await NotificationModel.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user._id,
      },
      {
        isRead: true,
      },
      {
        new: true,
      },
    );

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("MARK NOTIFICATION AS READ ERROR:", error);

    return res.status(500).json({
      message: "Failed to mark notification as read",
    });
  }
};

export default {
  getNotifications, markNotificationAsRead
};