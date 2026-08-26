import type { NextFunction, Request, Response } from "express";

/**
 * Validates that the Content-Length header, when present, matches the actual
 * received body size. A mismatch indicates a truncated or padded payload and
 * is rejected before it reaches the JSON/urlencoded parsers.
 *
 * Fixes #449.
 */
export function validateContentLength(req: Request, res: Response, next: NextFunction): void {
  const declared = req.headers["content-length"];

  // No header — nothing to validate; downstream parsers handle it.
  if (declared === undefined) {
    next();
    return;
  }

  const declaredBytes = parseInt(declared, 10);
  if (isNaN(declaredBytes) || declaredBytes < 0) {
    res.status(400).json({
      error: { code: "INVALID_CONTENT_LENGTH", message: "Invalid Content-Length header" },
    });
    return;
  }

  let received = 0;
  req.on("data", (chunk: Buffer) => {
    received += chunk.length;
    // Early abort if body already exceeds declared size.
    if (received > declaredBytes) {
      res.status(400).json({
        error: {
          code: "CONTENT_LENGTH_MISMATCH",
          message: "Request body exceeds declared Content-Length",
        },
      });
      req.destroy();
    }
  });

  req.on("end", () => {
    if (!res.headersSent && received !== declaredBytes) {
      res.status(400).json({
        error: {
          code: "CONTENT_LENGTH_MISMATCH",
          message: "Request body size does not match Content-Length",
        },
      });
      return;
    }
    if (!res.headersSent) {
      next();
    }
  });
}
