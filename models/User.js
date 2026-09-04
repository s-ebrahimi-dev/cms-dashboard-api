import mongoose from "mongoose";
const schema = new mongoose.Schema(
  { firstname: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },

    lastname: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },
    
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: Number,
      required: true,
      trim: true,
      minlength: 11,
      maxlength: 11,
    },
    password: {
      type: String,
      required: true,
      trim: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: [
        "ADMIN",
        "CUSTOMER",
        "RECEPTIONIST",
        "MECHANIC",
        "OIL_TECHNICIAN",
        "BODY_REPAIR",
        "DETAILING_TECHNICIAN",
        "WASH_TECHNICIAN",
      ],
      default: "CUSTOMER",
    },
  },
  {
    timestamps: true,
  },
);
const model = mongoose.model("User", schema);

export default model;
