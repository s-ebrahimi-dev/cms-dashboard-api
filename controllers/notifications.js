import NotificationModel from "../models/Notifications.js";

const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    const notifications = await NotificationModel.find({
      recipient: userId,
    })
      .populate("sender", "username role profileImage")
      .sort({ createdAt: -1 });

    const formattedNotifications = notifications.map(
      (notification) => {
        const notificationObject = notification.toObject();

        if (notificationObject.sender) {
          const sender = notificationObject.sender;

          notificationObject.sender = {
            _id: sender._id,
            username: sender.username,
            role: sender.role,
            hasProfileImage: Boolean(
              sender.profileImage?.data,
            ),
          };
        }

        return notificationObject;
      },
    );

    return res.status(200).json({
      success: true,
      notifications: formattedNotifications,
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