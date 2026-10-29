import crypto from "node:crypto";

const getSecret = () => {
  const secret = process.env.EMAIL_VERIFICATION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "EMAIL_VERIFICATION_SECRET must be configured with a strong secret.",
    );
  }

  return secret;
};

export const generateVerificationCode = () =>
  crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

export const hashVerificationCode = (code) =>
  crypto
    .createHmac("sha256", getSecret())
    .update(code)
    .digest("hex");

export const isVerificationCodeValid = (code, storedHash) => {
  const candidateHash = hashVerificationCode(code);

  if (
    typeof storedHash !== "string" ||
    !/^[a-f0-9]{64}$/i.test(storedHash)
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(candidateHash, "hex"),
    Buffer.from(storedHash, "hex"),
  );
};