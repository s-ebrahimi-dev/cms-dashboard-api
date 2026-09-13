import dotenv from "dotenv";

import bcrypt from "bcrypt";

import connectDB from "./configs/db.js";

import UserModel from "./models/User.js";
import validator from "./validator/users.js";
dotenv.config();
const createAdmin = async () => {
  try {
    await connectDB();

    const existingAdmin = await UserModel.findOne({ role: "ADMIN" });

    if (existingAdmin) {
      console.log("An admin already exists.");
      return;
    }

    const adminData = {
      firstname: "saeed",
      lastname: "ebrahimi",
      username: "s_ebrahimi_m",
      email: "s.ebrahimi.dev@gmail.com",
      phone: "09153044651",
      password: "saeed4651&H",
      confirmPassword: "saeed4651&H",
      role: "ADMIN",
    };

    const { error, value } =
      validator.createUserSchema.validate(adminData);

    if (error) {
      console.error("VALIDATION ERROR:", error.details[0].message);
      return;
    }

    const {
      firstname,
      lastname,
      username,
      email,
      phone,
      password,
      role,
    } = value;

    const hashedPassword = await bcrypt.hash(password, 10);

    await UserModel.create({
      firstname,
      lastname,
      username,
      email,
      phone,
      password: hashedPassword,
      role,
    });

    console.log("✅ Initial admin created successfully!");
  } catch (error) {
    console.error("CREATE ADMIN ERROR:", error);
  } finally {
    process.exit();
  }
};

createAdmin();