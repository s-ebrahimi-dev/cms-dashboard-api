import nodemailer from "nodemailer";

let transporterPromise;

const getTransporter = () => {
  if (!transporterPromise) {
    transporterPromise = nodemailer
      .createTestAccount()
      .then((account) =>
        nodemailer.createTransport({
          host: account.smtp.host,
          port: account.smtp.port,
          secure: account.smtp.secure,
          auth: {
            user: account.user,
            pass: account.pass,
          },
        }),
      )
      .catch((error) => {
        transporterPromise = null;
        throw error;
      });
  }

  return transporterPromise;
};

export const sendVerificationEmail = async (email, code) => {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: '"AutoCare" <no-reply@autocare.test>',
    to: email,
    subject: "Verify your AutoCare email",
    text: `Your AutoCare verification code is ${code}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Verify your email</h2>
        <p>Enter this code to complete your AutoCare registration:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">
          ${code}
        </p>
        <p>This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
      </div>
    `,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  console.log("Ethereal email preview URL:", previewUrl);

  return { messageId: info.messageId, previewUrl };
};