import { Request, Response, NextFunction } from "express";
import passport from "passport";
import { log, formatNotification } from "../../utils/logging/logger";
import sanitizeUser from "../../utils/auth/sanitizeUser";

const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await new Promise<void>((resolve, reject) => {
      passport.authenticate(
        "local",
        (err: any, user: Express.User, info: { message: any }) => {
          if (err) {
            log({ type: "error", message: "Login error", meta: err });
            return reject(err);
          }
          if (!user) {
            log({
              type: "error",
              message: info?.message || "Invalid email or password.",
            });
            return res
              .status(401)
              .json(
                formatNotification(
                  info?.message ||
                    "Invalid email or password. Please try again.",
                  "error"
                )
              );
          }
          req.logIn(user, (err) => {
            if (err) {
              log({ type: "error", message: "Login error", meta: err });
              return reject(err);
            }
            log({
              type: "success",
              message: `User logged in: ${user && (user as any).email}`,
            });
            res.json({
              user: sanitizeUser(user),
              ...formatNotification("Login successful!", "success"),
            });
            resolve();
          });
        }
      )(req, res, next);
    });
  } catch (err) {
    log({ type: "error", message: "Login failed", meta: err });
    next(err);
  }
};

export default login;
