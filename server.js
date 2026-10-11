import express from "express";
import cors from "cors";
import userRouter from "./routes/users.js";
import conversationRouter from "./routes/conversations.js";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./configs/db.js";
import notificationRouter from "./routes/notifications.js";
import appointmentRouter from "./routes/appointment.js";
import vehicleRouter from "./routes/vehicles.js";
import serviceRouter from "./routes/services.js";
dotenv.config();

const app = express();

app.use(cookieParser());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Backend is alive",
  });
});

app.use("/api/users", userRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/conversations", conversationRouter);
app.use("/api/appointments", appointmentRouter);
app.use("/api/vehicles", vehicleRouter);
app.use("/api/services", serviceRouter);

app.use((req, res) => {
  res.status(404).json({
    message: "Route Not Found !!",
  });
});

const PORT = Number(process.env.PORT) || 4000;

const startServer = async () => {
  try {
    console.log("🔵 Starting server...");
    
    await connectDB();

     console.log("🟢 DB ready. Starting Express...");
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`server is running on port ${PORT} ✌️`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();