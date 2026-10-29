const SIGNALADS_BASE_URL = "https://transmitor.signalads.com";

const signaladsRequest = async (endpoint, body) => {
  console.log("DEBUG: signaladsRequest is running");
  const token = process.env.SIGNALADS_API_TOKEN;

  if (!token) {
    throw new Error("SIGNALADS_API_TOKEN is not configured.");
  }
  console.log("SignalAds endpoint:", `${SIGNALADS_BASE_URL}${endpoint}`);
  console.log("SignalAds request body:", JSON.stringify(body));
  const response = await fetch(`${SIGNALADS_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("SignalAds HTTP status:", response.status);
    console.error("SignalAds response body:", JSON.stringify(data, null, 2));

    const error = new Error(
      data?.message || `SignalAds request failed (${response.status}).`,
    );

    error.status = response.status;
    throw error;
  }

  return data;
};

export const sendOtp = (mobile) =>
  signaladsRequest("/api_v1/otp/send", {
    mobile,
    pattern_id: 2514,

  });

export const retryOtp = (uuid) =>
  signaladsRequest("/api_v1/otp/retry", {
    uuid,
  });

export const verifyOtp = (uuid, code) =>
  signaladsRequest("/api_v1/otp/verify", {
    uuid,
    code,
  });
