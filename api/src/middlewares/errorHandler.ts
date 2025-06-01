import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(err);

  const status = err.status || 500;
  let message = "An unexpected error occurred. Please try again.";

  if (err.isCustom && err.message) {
    message = err.message;
  } else if (status === 400) {
    message = "Invalid request. Please check your input.";
  } else if (status === 401) {
    message = "You are not authorized. Please log in.";
  } else if (status === 404) {
    message = "Resource not found.";
  }

  res.status(status).json({ error: message });
}
