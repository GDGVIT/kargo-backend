import nodemailer from "nodemailer";
import env from "../../config/env";

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

const FROM_ADDRESS = env.SMTP_FROM;

export async function sendMail({
  to,
  subject,
  html,
  text,
  from = FROM_ADDRESS,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}) {
  try {
    await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text,
    });
  } catch (err) {
    console.error("Failed to send email:", err);
    throw new Error("Failed to send email.");
  }
}
