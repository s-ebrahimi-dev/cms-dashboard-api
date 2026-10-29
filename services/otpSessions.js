
const otpSessions = new Map();

export const saveOtpSession = (uuid, phone, expireAt) => {
  otpSessions.set(uuid, {
    phone,
    expireAt: new Date(expireAt).getTime(),
  });
};

export const getOtpSession = (uuid) => {
  const session = otpSessions.get(uuid);

  if (!session) return null;

  if (Date.now() >= session.expireAt) {
    otpSessions.delete(uuid);
    return null;
  }

  return session;
};

export const deleteOtpSession = (uuid) => {
  otpSessions.delete(uuid);
};
