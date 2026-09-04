import express from "express";
import bcrypt from "bcrypt";
import validator from "../validator/users.js";
import jwt from "jsonwebtoken";
import UserModel from "../models/User.js";


const getAllUsers = async (req, res) => {
  const users = await UserModel.find().sort({createdAt: -1});

  return res.status(200).json({
    data: users,
    message: "Users retrieved successfully :))",
  });
};

const getOneUser = async (req, res) => {
 const { id } = req.params;

    const findedUser = await UserModel.findById(id).lean();

    if (!findedUser) {
        return res.status(404).json({
            message: "User not found with this info :(("
        });
    }

    return res.status(200).json({
        data: findedUser,
        message: "User retrieved successfully :))"
    });
};

const registerUser = async (req, res) => {
  const { error, value } = validator.registerSchema.validate(req.body || {});

  console.log(error);

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
   const {
    firstname,
    lastname,
    username,
    email,
    phone,
     password,
  } = value;

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = {
    firstname,
    lastname,
    username,
    email,
    phone,
    password: hashedPassword,
    role: "CUSTOMER"
  };

  const user = await UserModel.create(newUser);
  
  const userWithoutPassword = user.toObject();
  delete userWithoutPassword.password;


  return res.status(201).json({
    data: userWithoutPassword,
    message: "User registered successfully :))",
  });
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
    secure: true, // true in production with HTTPS
    sameSite: "lax",
    maxAge: 10 * 24 * 60 * 60 * 1000,
  });
  const { password: _, ...foundUserWithoutpass } = foundUser;
  return res.status(200).json({
    data: { ...foundUserWithoutpass, token },
    message: "User logged in successfully :))",
  });
};

const removeUser = async (req, res) => {
  const { id } = req.params 

   if (!id) {
    return res.status(400).json({ message: "User id is required" });
  }

 
  await UserModel.findByIdAndDelete(id)

  return res.status(200).json({ message: "User removed successfully :))" });
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const { username, email } = req.body;
    const user = await UserModel.findById(id);

    if (user) {
      user.username = username || user.username;
      user.email = email || user.email;
      
      await user.save()
      return res.status(200).json({message:"User Updated successfully :))"})
    } else {
      return res.status(404).json({message:"User Not Found with this infos :(("})
    }
  } catch (error) {
    return res.status(500).json({message: error.message})
  }
}

const updateUserDocument = async(req, res) => {
  try {
    const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          message: "Invalid user ID",
          success: false
        });
    }
    const { username, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);


    const user = await UserModel.findByIdAndUpdate(id, {username, email, password:hashedPassword}, {
      returnDocument: "after",
    })
    if (user) {
      return res.status(200).json({data: user, message: "User Updated successfully"})
    } else {
            return res.status(404).json({message: "User Not Found"})

    }
  } catch (error) {
    return res.status(500).json({message: error.message})
  }
}
export default { getAllUsers, getOneUser, registerUser, loginUser, removeUser, updateUser,updateUserDocument };
