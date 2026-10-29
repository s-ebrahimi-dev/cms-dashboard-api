import express from "express";
import bcrypt from "bcrypt";
import validator from "../validator/users.js";
import jwt from "jsonwebtoken";
import UserModel from "../models/User.js";
import {
  sendOtp,
  retryOtp as retrySignalAdsOtp,
  verifyOtp as verifySignalAdsOtp,
} from "../services/signalads.service.js";
import {
  saveOtpSession,
  getOtpSession,
  deleteOtpSession,
} from "../services/otpSessions.js";
const TECHNICIAN_ROLES = [
  "MECHANIC",
  "OIL_TECHNICIAN",
  "BODY_REPAIR",
  "DETAILING_TECHNICIAN",
  "WASH_TECHNICIAN",
];

const getMe = async (req, res) => {
  console.log("🔥 GET ME CONTROLLER EXECUTED");
  try {
    const user = req.user.toObject();
    const hasProfileImage = Boolean(user.profileImage?.data);
    console.log("🔥 HAS PROFILE IMAGE:", hasProfileImage);
    delete user.password;
    delete user.profileImage;

    return res.status(200).json({
      data: { ...user, hasProfileImage },
      message: "Current user retrieved successfully :))",
    });
  } catch (error) {
    console.error("GET ME ERROR:", error);

    return res.status(500).json({
      message: "Failed to retrieve current user.",
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const filter = {};

    if (req.query.role) {
      filter.role = req.query.role.toUpperCase();
    }

    const users = await UserModel.find(filter)
      .select("firstname lastname username email phone role profileImage")
      .sort({ createdAt: -1 });
    const formattedUsers = users.map((user) => {
      const userData = user.toObject();

      userData.hasProfileImage = Boolean(
        userData.profileImage?.data?.length &&
        userData.profileImage?.contentType,
      );

      delete userData.profileImage;

      return userData;
    });
    return res.status(200).json({
      data: formattedUsers,
      message: "Users retrieved successfully.",
    });
  } catch (error) {
    console.error("Failed to retrieve users:", error);

    return res.status(500).json({
      message: "Failed to retrieve users.",
    });
  }
};
const getContactableEmployees = async (req, res) => {
  try {
    const employees = await UserModel.find({
      role: {
        $nin: ["ADMIN", "CUSTOMER"],
      },
    }).select("firstname lastname role profileImage");

    const formattedEmployees = employees.map((employee) => {
      const employeeData = employee.toObject();

      employeeData.hasProfileImage = Boolean(
        employeeData.profileImage?.data?.length &&
        employeeData.profileImage?.contentType,
      );

      delete employeeData.profileImage;

      return employeeData;
    });

    return res.status(200).json({
      data: formattedEmployees,
      message: "Contactable employees retrieved successfully.",
    });
  } catch (error) {
    console.error("GET CONTACTABLE EMPLOYEES ERROR:", error);

    return res.status(500).json({
      message: "Failed to retrieve contactable employees.",
    });
  }
};

const getOneUser = async (req, res) => {
  const { id } = req.params;

  const findedUser = await UserModel.findById(id).lean();

  if (!findedUser) {
    return res.status(404).json({
      message: "User not found with this info :((",
    });
  }

  return res.status(200).json({
    data: findedUser,
    message: "User retrieved successfully :))",
  });
};

const registerUser = async (req, res) => {
  try {
    const { error, value } = validator.registerSchema.validate(req.body || {});

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const { firstname, lastname, username, email, phone, password } = value;

    // Normalize values before checking for duplicates.
    const normalizedUsername = username.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing unique fields.
    const existingPhone = await UserModel.exists({ phone });

    if (existingPhone) {
      return res.status(409).json({
        message: "This phone number is already registered.",
      });
    }

    const existingEmail = await UserModel.exists({
      email: normalizedEmail,
    });

    if (existingEmail) {
      return res.status(409).json({
        message: "This email is already registered.",
      });
    }

    const existingUsername = await UserModel.exists({
      username: normalizedUsername,
    });

    if (existingUsername) {
      return res.status(409).json({
        message: "This username is already taken.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await UserModel.create({
      firstname,
      lastname,
      username: normalizedUsername,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
      role: "CUSTOMER",
    });

    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;

    return res.status(201).json({
      data: userWithoutPassword,
      message: "User registered successfully.",
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];

      const messages = {
        phone: "This phone number is already registered.",
        email: "This email is already registered.",
        username: "This username is already taken.",
      };

      return res.status(409).json({
        message:
          messages[duplicateField] ||
          "A record with this information already exists.",
      });
    }

    return res.status(500).json({
      message: "An unexpected error occurred during registration.",
    });
  }
};

const loginUser = async (req, res) => {
  const { error, value } = validator.loginSchema.validate(req.body || {});

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const { identifier, password } = value;

  const foundUser = await UserModel.findOne({
    $or: [{ username: identifier }, { email: identifier }],
  })
    .select("+password")
    .lean();

  if (!foundUser) {
    return res.status(401).json({
      message: "Invalid username/email or password",
    });
  }

  const isPasswordValid = await bcrypt.compare(password, foundUser.password);

  if (!isPasswordValid) {
    return res.status(401).json({
      message: "Invalid username/email or password",
    });
  }

  const token = jwt.sign({ id: foundUser._id }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "10d",
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: false, // true in production with HTTPS
    sameSite: "lax",
    maxAge: 10 * 24 * 60 * 60 * 1000,
  });
  const { password: _, ...foundUserWithoutpass } = foundUser;
  return res.status(200).json({
    data: { ...foundUserWithoutpass, token },
    message: "User logged in successfully :))",
  });
};

const createUser = async (req, res) => {
  try {
    const { error, value } = validator.createUserSchema.validate(
      req.body || {},
    );

    console.log("CREATE BODY:", req.body);

    if (error) {
      return res.status(400).json({
        message: error.details[0].message,
      });
    }

    const {
      firstname,
      lastname,
      username,
      email,
      phone,
      password,
      role,
      maxConcurrentVehicles,
    } = value;

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      firstname,
      lastname,
      username,
      email,
      phone,
      password: hashedPassword,
      role,
    };

    if (TECHNICIAN_ROLES.includes(role)) {
      newUser.maxConcurrentVehicles = maxConcurrentVehicles ?? 1;
    }

    const user = await UserModel.create(newUser);

    const userWithoutPassword = user.toObject();

    delete userWithoutPassword.password;

    return res.status(201).json({
      data: userWithoutPassword,
      message: "User created successfully :))",
    });
  } catch (error) {
    console.error("CREATION ERROR:", error);

    return res.status(500).json({
      message: error.message,
    });
  }
};

const removeUser = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "User id is required" });
  }

  await UserModel.findByIdAndDelete(id);

  return res.status(200).json({ message: "User removed successfully :))" });
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const { firstname, lastname, username, email, phone, password } = req.body;

    const user = await UserModel.findById(id);

    if (!user) {
      return res.status(404).json({
        message: "User Not Found",
      });
    }

    user.firstname = firstname ?? user.firstname;
    user.lastname = lastname ?? user.lastname;
    user.username = username ?? user.username;
    user.email = email ?? user.email;
    user.phone = phone ?? user.phone;

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    return res.status(200).json({
      data: user,
      message: "User Updated successfully",
    });
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);

    return res.status(500).json({
      message: error.message,
    });
  }
};
const updateOwnProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const { firstname, lastname, username, email, phone, password } = req.body;

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        firstname,
        lastname,
        username,
        email,
        phone,
        ...(password ? { password } : {}),
      },
      {
        new: true,
        runValidators: true,
      },
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("UPDATE OWN PROFILE ERROR:", error);

    return res.status(500).json({
      message: "Failed to update profile",
    });
  }
};

const updateUserDocument = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
        success: false,
      });
    }
    const { username, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await UserModel.findByIdAndUpdate(
      id,
      { username, email, password: hashedPassword },
      {
        returnDocument: "after",
      },
    );
    if (user) {
      return res
        .status(200)
        .json({ data: user, message: "User Updated successfully" });
    } else {
      return res.status(404).json({ message: "User Not Found" });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "Please select an image.",
      });
    }

    const user = req.user;

    user.profileImage = {
      data: req.file.buffer,
      contentType: req.file.mimetype,
    };

    await user.save();

    res.status(200).json({
      message: "Profile picture updated successfully.",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to upload profile picture.",
    });
  }
};
const getProfileImage = async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);

    if (!user?.profileImage?.data) {
      return res.status(404).end();
    }

    res.set("Content-Type", user.profileImage.contentType);
    res.send(user.profileImage.data);
  } catch (error) {
    console.error("GET PROFILE IMAGE ERROR:", error);

    res.status(500).json({
      message: "Failed to load profile picture.",
    });
  }
};

const getMyProfileImage = async (req, res) => {
  try {
    const user = req.user;

    if (!user?.profileImage?.data) {
      return res.status(404).end();
    }

    res.set("Content-Type", user.profileImage.contentType);
    res.send(user.profileImage.data);
  } catch (error) {
    console.error("GET MY PROFILE IMAGE ERROR:", error);

    res.status(500).json({
      message: "Failed to load profile picture.",
    });
  }
};

const logoutUser = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });

  return res.status(200).json({
    message: "Logged out successfully.",
  });
};

const normalizeIranianPhone = (phone) => {
  const normalized = String(phone ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[\s-]/g, "");

  // Accept 09xxxxxxxxx or +989xxxxxxxxx.
  if (/^09[0-9]{9}$/.test(normalized)) {
    return normalized;
  }

  if (/^\+989[0-9]{9}$/.test(normalized)) {
    return `0${normalized.slice(3)}`;
  }

  return null;
};

const requestOtp = async (req, res) => {
  try {
    const phone = normalizeIranianPhone(req.body?.phone);

    if (!phone) {
      return res.status(400).json({
        message: "Enter a valid Iranian mobile number.",
      });
    }

    const user = await UserModel.findOne({ phone }).select("_id phone");

    if (!user) {
      return res.status(404).json({
        message: "No account is registered with this phone number.",
      });
    }

    // SignalAds accepts the international Iranian format.
    const mobile = `+98${phone.slice(1)}`;
    const result = await sendOtp(mobile);

    if (typeof result?.uuid !== "string" || !result.uuid || !result.expire_at) {
      console.error("Unexpected SignalAds send response.");
      return res.status(502).json({
        message: "The OTP provider returned an invalid response.",
      });
    }

    const expireAt = new Date(result.expire_at).getTime();

    if (!Number.isFinite(expireAt) || expireAt <= Date.now()) {
      return res.status(502).json({
        message: "The OTP provider returned an invalid expiration time.",
      });
    }

    saveOtpSession(result.uuid, phone, result.expire_at);

    return res.status(200).json({
      message: "OTP sent successfully.",
      uuid: result.uuid,
      expireAt: result.expire_at,
    });
  } catch (error) {
    console.error("REQUEST OTP ERROR:", error.message);

    return res.status(502).json({
      message: "Unable to send OTP. Please try again later.",
    });
  }
};

const retryOtp = async (req, res) => {
  try {
    const { uuid } = req.body ?? {};

    if (typeof uuid !== "string" || !uuid.trim()) {
      return res.status(400).json({
        message: "A valid OTP session UUID is required.",
      });
    }

    const session = getOtpSession(uuid);

    if (!session) {
      return res.status(400).json({
        message: "OTP session not found or expired. Request a new code.",
      });
    }

    const result = await retrySignalAdsOtp(uuid);

    if (
      result?.uuid !== uuid ||
      !result?.expire_at ||
      !Number.isFinite(new Date(result.expire_at).getTime()) ||
      new Date(result.expire_at).getTime() <= Date.now()
    ) {
      return res.status(502).json({
        message: "The OTP provider returned an invalid response.",
      });
    }

    // Refresh the expiration time for the existing session.
    saveOtpSession(uuid, session.phone, result.expire_at);

    return res.status(200).json({
      message: "A new OTP has been sent.",
      uuid,
      expireAt: result.expire_at,
    });
  } catch (error) {
    console.error("RETRY OTP ERROR:", error.message);

    return res.status(502).json({
      message: "Unable to resend OTP. Please try again later.",
    });
  }
};

const normalizeOtpCode = (code) =>
  String(code ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

const verifyOtp = async (req, res) => {
  try {
    const { uuid } = req.body ?? {};
    const code = normalizeOtpCode(req.body?.code);

    if (
      typeof uuid !== "string" ||
      !uuid.trim() ||
      !/^[0-9]{4,6}$/.test(code)
    ) {
      return res.status(400).json({
        message: "A valid session UUID and OTP code are required.",
      });
    }

    const session = getOtpSession(uuid);

    if (!session) {
      return res.status(400).json({
        message: "OTP session not found or expired. Request a new code.",
      });
    }

    // Ask SignalAds to verify the code.
    const result = await verifySignalAdsOtp(uuid, code);

    if (result?.uuid !== uuid || result?.verified !== true) {
      return res.status(401).json({
        message: "OTP verification failed.",
      });
    }

    // The phone comes from our server-side session, not the request.
    const user = await UserModel.findOne({
      phone: session.phone,
    });

    // SignalAds has already consumed a successfully verified OTP.
    deleteOtpSession(uuid);

    if (!user) {
      return res.status(401).json({
        message: "The account associated with this OTP no longer exists.",
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "10d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 24 * 60 * 60 * 1000,
    });

    const userWithoutPassword = user.toObject();
    delete userWithoutPassword.password;
    delete userWithoutPassword.profileImage;

    return res.status(200).json({
      data: {
        ...userWithoutPassword,
        hasProfileImage: Boolean(user.profileImage?.data),
        token,
      },
      message: "User logged in successfully.",
    });
  } catch (error) {
    console.error("VERIFY OTP ERROR:", error.message);

    return res.status(502).json({
      message: "Unable to verify OTP. Please try again.",
    });
  }
};

export default {
  getProfileImage,
  getMyProfileImage,
  uploadProfileImage,
  getMe,
  getAllUsers,
  getContactableEmployees,
  getOneUser,
  registerUser,
  loginUser,
  createUser,
  removeUser,
  updateUser,
  updateOwnProfile,
  updateUserDocument,
  logoutUser,
  requestOtp,
  retryOtp,
  verifyOtp,
};
