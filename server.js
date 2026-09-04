import express from "express";
import cors from "cors";
import userRouter from "./routes/users.js";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import connectDB from "./configs/db.js";
dotenv.config();
const app = express();

await connectDB();

app.use(cookieParser());
app.use(
  cors({
    origin: "https://resplendent-gumption-6a631d.netlify.app",
    credentials: true,
  }),
);
app.use(express.json());
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Backend is alive"
  });
});
app.use("/api/users", userRouter);

app.use((req, res) => {
  res.status(404).json({ message: "Route Not Found !!" });
});

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`server is running on port ${PORT} ✌️`);
});