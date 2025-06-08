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
