import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
   participants: {
  type: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  ],
  validate: {
    validator: (participants) => participants.length === 2,
    message: "A conversation must have exactly two participants",
  },
},
    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
    },

    lastMessage: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const ConversationModel = mongoose.model(
  "Conversation",
  conversationSchema,
);

export default ConversationModel;