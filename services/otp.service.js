// services/otp.service.js
import { randomInt, createHmac } from "node:crypto";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function generateOTP() {
  return randomInt(0, 1_000_000)
    .toString()
    .padStart(6, "0");
}

function hashOTP(phone, code) {
  return createHmac("sha256", process.env.OTP_HMAC_SECRET)
    .update(`${phone}:${code}`)
    .digest("hex");
}

export {
  generateOTP,
  hashOTP,
  OTP_TTL_MS,
  MAX_ATTEMPTS,
};