import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./configs/db.js";
import UserModel from "./models/User.js";
import NotificationModel from "./models/Notifications.js";

dotenv.config();

console.log("🚀 Test script started");

const createTestNotification = async () => {
  try {
    console.log("🔵 Connecting to DB...");

    await connectDB();

    console.log("🟢 DB connected");

    const user = await UserModel.findById("6aa62ba82179714395769bbf");

    console.log("👤 User found:", user?._id);

    if (!user) {
      console.log("No user found.");
      return;
    }

    const notification = await NotificationModel.create({
      sender: null,
      recipient: user._id,
      type: "SYSTEM",
      title: "Test Notification",
      message: "This is a test system notification.",
    });

    console.log("🔔 Notification created:");
    console.log(notification);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔴 DB connection closed");
  }
};

createTestNotification();