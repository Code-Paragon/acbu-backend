import { Request, Response, NextFunction } from "express";
import { config } from "../config/env";
import { AppError } from "./errorHandler";

/**
 * Guard for admin-only endpoints (e.g. /health/deep, /health/metrics).
 * Requires the `x-admin-key` header to match ADMIN_API_KEY env var.
 * If ADMIN_API_KEY is not configured, the endpoint is blocked entirely.
 */
export function requireAdminApiKey(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const { adminApiKey } = config;
  if (!adminApiKey) {
    next(new AppError("Admin endpoint not available", 503));
    return;
  }
  const provided = req.headers["x-admin-key"];
  if (!provided || provided !== adminApiKey) {
    next(new AppError("Unauthorized", 401));
    return;
  }
  next();
}
