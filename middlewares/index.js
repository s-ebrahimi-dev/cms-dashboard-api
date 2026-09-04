import jwt from "jsonwebtoken";
import mongoose from "mongoose"
import UserModel from "../models/User.js";


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
export default { checkAdmin, checkObjectId };
