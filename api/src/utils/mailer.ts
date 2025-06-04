import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_ADDRESS = process.env.SMTP_FROM;

export async function sendVerificationEmail({
  to,
  token,
  domain,
}: {
  to: string;
  token: string;
  domain: string;
}) {
  const verifyUrl = `${domain}/auth/verify-email?token=${token}`;
  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to,
      subject: "Verify your email address",
      html: `<p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });
  } catch (err) {
    console.error("Failed to send verification email:", err);
    throw new Error("Failed to send verification email.");
  }
}
