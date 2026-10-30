import jwt from "jsonwebtoken";
import mongoose from "mongoose"
import UserModel from "../models/User.js";


const checkAuth = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({
        message: "Token required!",
      });
    }

    const secret = process.env.JWT_SECRET;
    const decoded = jwt.verify(token, secret);

    const foundUser = await UserModel.findById(decoded.id);

    if (!foundUser) {
      return res.status(401).json({
        message: "User not found.",
      });
    }

    req.user = foundUser;

    next();
  } catch (error) {
    console.error("AUTHENTICATION ERROR:", error);

    return res.status(401).json({
      message: "You can't access this route!",
    });
  }
};

const checkAdmin = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({
      message: "Token required !!",
    });
  }

  const secret = process.env.JWT_SECRET;

  jwt.verify(token, secret, async (error, decoded) => {
    if (error) {
      return res.status(401).json({
        message: "You can't access this route!",
      });
    }

    const { id } = decoded;

    const foundUser = await UserModel.findById(id);

    if (!foundUser) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    if (foundUser.role !== "ADMIN") {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    req.user = foundUser;

    next();
  });
};

const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You are not authorized to access this route.",
      });
    }

    next();
  };
};


const checkObjectId = (req, res, next) => {
   const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({
            message: "Invalid user ID",
            success: false
          });
  }
  next()
}
export default {checkAuth, checkAdmin, checkObjectId, checkRole };
