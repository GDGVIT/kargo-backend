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

const FROM_ADDRESS = process.env.SMTP_FROM || `no-reply@yourdomain.com`;

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
  await transporter.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: "Verify your email address",
    html: `<p>Click the link below to verify your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}
