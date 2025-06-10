import { IUser } from "../../types/user.types";

function sanitizeUser(user: any): Partial<IUser> {
  const safeUser = { ...(user.toObject?.() || user) };
  if (safeUser.password) delete safeUser.password;
  if (safeUser.verificationToken) delete safeUser.verificationToken;
  return safeUser;
}

export default sanitizeUser;
