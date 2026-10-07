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
  return conversation.participants.some(
    (participant) => participant._id.toString() === userId.toString(),
  );
};
const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await ConversationModel.find({
      participants: userId,
    })
      .populate("participants", "firstname lastname username role profileImage")
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
    const { participant } = req.body;
    const currentUser = req.user;

    if (!participant) {
      return res.status(400).json({
        message: "Participant is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(participant)) {
      return res.status(400).json({
        message: "Invalid participant ID",
      });
    }

    // Prevent conversations with yourself
    if (currentUser._id.toString() === participant.toString()) {
      return res.status(400).json({
        message: "You cannot create a conversation with yourself",
      });
    }

    // Find selected participant
    const targetUser = await UserModel.findById(participant);

    if (!targetUser) {
      return res.status(404).json({
        message: "Participant not found",
      });
    }

    const currentUserIsCustomer = currentUser.role === "CUSTOMER";

    const targetUserIsCustomer = targetUser.role === "CUSTOMER";

    // Customer ↔ Customer is not allowed
    if (currentUserIsCustomer && targetUserIsCustomer) {
      return res.status(403).json({
        message: "Customers cannot start conversations with other customers",
      });
    }

    // Check if conversation already exists
    let conversation = await ConversationModel.findOne({
      participants: {
        $all: [currentUser._id, participant],
      },
    });

    if (conversation) {
      conversation = await ConversationModel.findById(
        conversation._id,
      ).populate(
        "participants",
        "firstname lastname username role profileImage",
      );

      return res.status(200).json({
        data: conversation,
        message: "Conversation already exists",
      });
    }

    // Create new conversation
    conversation = await ConversationModel.create({
      participants: [currentUser._id, participant],
    });

    // Populate participants
    conversation = await ConversationModel.findById(conversation._id).populate(
      "participants",
      "firstname lastname username role profileImage",
    );

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

    const conversation = await ConversationModel.findById(id).populate(
      "participants",
      "firstname lastname username role profileImage",
    );

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
      .populate("sender", "firstname lastname username role profileImage")
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
    const { id: conversationId } = req.params;
    const { message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
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

    const conversation = await ConversationModel.findById(conversationId);

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

    const receiver = conversation.participants.find(
      (participant) => participant.toString() !== sender.toString(),
    );

    if (!receiver) {
      return res.status(400).json({
        message: "Conversation receiver not found",
      });
    }

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
      conversation: conversationId,
      type: "MESSAGE",
      title: "New Message",
      message: message.trim(),
      isRead: false,
    });
    const populatedMessage = await MessageModel.findById(
      newMessage._id,
    ).populate("sender", "firstname lastname username role profileImage");

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

const markConversationAsRead = async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        message: "Invalid conversation ID",
      });
    }

    const conversation = await ConversationModel.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found",
      });
    }

    const isParticipant = conversation.participants.some(
      (participant) => participant.toString() === userId.toString(),
    );

    if (!isParticipant) {
      return res.status(403).json({
        message: "You are not a participant in this conversation",
      });
    }

    const messageResult = await MessageModel.updateMany(
      {
        conversation: conversationId,
        receiver: userId,
        read: false,
      },
      {
        $set: {
          read: true,
        },
      },
    );

    const notificationResult = await NotificationModel.updateMany(
      {
        conversation: conversationId,
        recipient: userId,
        type: "MESSAGE",
        isRead: false,
      },
      {
        $set: {
          isRead: true,
        },
      },
    );

    return res.status(200).json({
      success: true,
      message: "Conversation marked as read",
      data: {
        messagesUpdated: messageResult.modifiedCount,
        notificationsUpdated: notificationResult.modifiedCount,
      },
    });
  } catch (error) {
    console.error("MARK CONVERSATION AS READ ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to mark conversation as read",
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
  markConversationAsRead,
};
