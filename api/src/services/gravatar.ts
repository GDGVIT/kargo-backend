import crypto from "crypto";

export const generateGravatarUrl = (email: string) => {
  const hash = crypto
    .createHash("md5")
    .update(email.trim().toLowerCase())
    .digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?d=identicon`;
};
