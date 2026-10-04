import mongoose from "mongoose";

import ConversationModel from "../models/Conversations.js";
import MessageModel from "../models/Messages.js";
import NotificationModel from "../models/Notifications.js";
import UserModel from "../models/User.js";

const EMPLOYEE_ROLES = [
  "RECEPTIONIST",
  "MECHANIC",
  "OIL_TECHNICIAN",
  "BODY_REPAIR",
  "DETAILING_TECHNICIAN",
  "WASH_TECHNICIAN",
];

const getFullName = (user) => {
  return `${user.firstname} ${user.lastname}`.trim();
};

const isEmployee = (user) => {
  return EMPLOYEE_ROLES.includes(user.role);
};

const canAccessConversation = (conversation, userId) => {
  return (
    conversation.customer._id.toString() === userId.toString() ||
    conversation.employee._id.toString() === userId.toString()
  );
};

const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const filter =
      req.user.role === "CUSTOMER"
        ? { customer: userId }
        : { employee: userId };
    const total = await ConversationModel.countDocuments(filter);
    console.log("Conversation filter:", filter);
    console.log("Total conversations in DB:", total);
    const conversations = await ConversationModel.find(filter)
      .populate("customer", "firstname lastname username role profileImage")
      .populate("employee", "firstname lastname username role profileImage")
      .sort({
        lastMessageAt: -1,
        updatedAt: -1,
      });

    return res.status(200).json({
      data: conversations,
      message: "Conversations retrieved successfully",
    });
  } catch (error) {
    console.error("GET CONVERSATIONS ERROR:", error);

    return res.status(500).json({
      message: "Failed to retrieve conversations",
    });
  }
};

const createConversation = async (req, res) => {
  try {
    const { employee } = req.body;
    const customer = req.user._id;

    if (req.user.role !== "CUSTOMER") {
      return res.status(403).json({
        message: "Only customers can start a conversation",
      });
    }

    if (!employee) {
      return res.status(400).json({
        message: "Employee is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(employee)) {
      return res.status(400).json({
        message: "Invalid employee ID",
      });
    }

    const employeeUser = await UserModel.findById(employee);

    if (!employeeUser) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    if (!isEmployee(employeeUser)) {
      return res.status(400).json({
        message: "Selected user is not an employee",
      });
    }

    let conversation = await ConversationModel.findOne({
      customer,
      employee,
    });

    if (conversation) {
      return res.status(200).json({
        data: conversation,
        message: "Conversation already exists",
      });
    }

    conversation = await ConversationModel.create({
      customer,
      employee,
    });

    conversation = await ConversationModel.findById(conversation._id)
      .populate("customer", "firstname lastname username role")
      .populate("employee", "firstname lastname username role");

    return res.status(201).json({
      data: conversation,
      message: "Conversation created successfully",
    });
  } catch (error) {
    console.error("CREATE CONVERSATION ERROR:", error);

    return res.status(500).json({
      message: "Failed to create conversation",
    });
  }
};

const getConversation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid conversation ID",
      });
    }

    const conversation = await ConversationModel.findById(id)
      .populate("customer", "firstname lastname username role")
      .populate("employee", "firstname lastname username role");

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    if (!canAccessConversation(conversation, req.user._id)) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    return res.status(200).json({
      data: conversation,
      message: "Conversation retrieved successfully",
    });
  } catch (error) {
    console.error("GET CONVERSATION ERROR:", error);

    return res.status(500).json({
      message: "Failed to retrieve conversation",
    });
  }
};

const getMessages = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid conversation ID",
      });
    }

    const conversation = await ConversationModel.findById(id);

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    if (!canAccessConversation(conversation, req.user._id)) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    const messages = await MessageModel.find({
      conversation: id,
    })
      .populate("sender", "firstname lastname username role")
      .sort({
        createdAt: 1,
      });

    return res.status(200).json({
      data: messages,
      message: "Messages retrieved successfully",
    });
  } catch (error) {
    console.error("GET MESSAGES ERROR:", error);

    return res.status(500).json({
      message: "Failed to retrieve messages",
    });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid conversation ID",
      });
    }

    if (!message?.trim()) {
      return res.status(400).json({
        message: "Message is required",
      });
    }

    if (message.trim().length > 1000) {
      return res.status(400).json({
        message: "Message cannot exceed 1000 characters",
      });
    }

    const conversation = await ConversationModel.findById(id);

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    if (!canAccessConversation(conversation, req.user._id)) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    if (conversation.status === "CLOSED") {
      return res.status(400).json({
        message: "This conversation is closed",
      });
    }

    const sender = req.user._id;

    const receiver =
      conversation.customer.toString() === sender.toString()
        ? conversation.employee
        : conversation.customer;

    const newMessage = await MessageModel.create({
      conversation: conversation._id,
      sender,
      receiver,
      message: message.trim(),
    });

    conversation.lastMessage = message.trim();
    conversation.lastMessageAt = newMessage.createdAt;

    await conversation.save();

    await NotificationModel.create({
      sender,
      recipient: receiver,
      type: "MESSAGE",
      title: "New Message",
      message: message.trim(),
      isRead: false,
    });

    const populatedMessage = await MessageModel.findById(
      newMessage._id,
    ).populate("sender", "firstname lastname username role");

    return res.status(201).json({
      data: populatedMessage,
      message: "Message sent successfully",
    });
  } catch (error) {
    console.error("SEND CONVERSATION MESSAGE ERROR:", error);

    return res.status(500).json({
      message: "Failed to send message",
    });
  }
};

const markMessageAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid message ID",
      });
    }

    const message = await MessageModel.findById(id);

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    if (message.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    message.read = true;

    await message.save();

    return res.status(200).json({
      data: message,
      message: "Message marked as read",
    });
  } catch (error) {
    console.error("MARK MESSAGE READ ERROR:", error);

    return res.status(500).json({
      message: "Failed to mark message as read",
    });
  }
};

export default {
  getConversations,
  createConversation,
  getConversation,
  getMessages,
  sendMessage,
  markMessageAsRead,
};
