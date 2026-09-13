import dns from "dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";

const connectDB = async () => {
  try {
      console.log("🟡 Trying to connect to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log("MongoDB connected successfully :))");

  } catch (error) {
    console.log("FULL ERROR:");
    console.log(error);

    process.exit(1);
  }
};

export default connectDB;