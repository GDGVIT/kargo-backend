import sendMail from "../email/mailer";

export async function sendVerificationEmail({
  to,
  token,
  domain,
  name,
}: {
  to: string;
  token: string;
  domain: string;
  name?: string;
}) {
  const verifyUrl = `${domain}/auth/verify-email?token=${token}`;
  const now = new Date();
  const formattedDate = now.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  let gravatarHash = "";
  try {
    gravatarHash = require("crypto")
      .createHash("md5")
      .update(to.trim().toLowerCase())
      .digest("hex");
  } catch (e) {
    gravatarHash = "";
  }
  await sendMail({
    to,
    subject: "Verify your email address",
    html: `
      <div style="background:#18181b;padding:32px 0;min-height:100vh;font-family:'Segoe UI',Arial,sans-serif;color:#fff;">
        <div style="max-width:420px;margin:40px auto;background:#23232a;border-radius:16px;box-shadow:0 4px 32px #0002;padding:32px 28px 28px 28px;">
          <div style="text-align:center;margin-bottom:24px;">
            <img src='https://www.gravatar.com/avatar/${gravatarHash}?d=identicon' alt='avatar' style='width:64px;height:64px;border-radius:50%;margin-bottom:8px;border:2px solid #333;' />
            <h2 style="margin:0 0 8px 0;font-size:1.5rem;font-weight:600;">${
              name ? `Hello, ${name}!` : "Welcome!"
            }</h2>
            <p style="margin:0 0 4px 0;font-size:1rem;color:#a1a1aa;">${to}</p>
            <p style="margin:0 0 0 0;font-size:0.95rem;color:#71717a;">${formattedDate}</p>
          </div>
          <h3 style="margin:0 0 16px 0;font-size:1.2rem;font-weight:500;">Verify your email address</h3>
          <p style="margin-bottom:24px;line-height:1.6;color:#d4d4d8;">Thank you for signing up! Please click the button below to verify your email address and activate your account.</p>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;background:#10b981;color:#fff;font-weight:600;font-size:1.1rem;border-radius:8px;text-decoration:none;box-shadow:0 2px 8px #10b98144;transition:background 0.2s;">Verify Email</a>
          </div>
          <p style="font-size:0.95rem;color:#a1a1aa;text-align:center;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break:break-all;font-size:0.93rem;color:#38bdf8;text-align:center;margin:8px 0 0 0;">${verifyUrl}</p>
          <hr style="border:none;border-top:1px solid #27272a;margin:32px 0 16px 0;" />
          <p style="font-size:0.85rem;color:#52525b;text-align:center;">&copy; ${now.getFullYear()} Kargo. All rights reserved.</p>
        </div>
      </div>
    `,
  });
}
