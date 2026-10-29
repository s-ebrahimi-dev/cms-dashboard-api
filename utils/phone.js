// utils/phone.js
import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizeIranPhone(value) {
  const phone = parsePhoneNumberFromString(value, "IR");

  if (!phone || !phone.isValid()) {
    throw new Error("Invalid phone number");
  }

  return phone.number;
}