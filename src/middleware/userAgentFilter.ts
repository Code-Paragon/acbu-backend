import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errorHandler";

/**
 * Patterns that identify known malicious scanners, credential-stuffing tools,
 * and broken/headless scripts. Checked case-insensitively.
 *
 * Override at runtime via the BLOCKED_USER_AGENT_PATTERNS environment variable
 * (comma-separated regex strings) to add project-specific rules without a
 * code change.
 */
const DEFAULT_BLOCKED_PATTERNS: RegExp[] = [
  // Generic scanners / fuzzers
  /masscan/,
  /zgrab/,
  /nmap/,
  /nikto/,
  /nuclei/,
  /sqlmap/,
  /dirbuster/,
  /gobuster/,
  /ffuf/,
  /wfuzz/,
  /hydra/,
  /medusa/,
  // Headless / scripted abuse tools
  /python-requests/,
  /go-http-client/,
  /libwww-perl/,
  /curl\/[0-9]/,   // bare curl (not curl wrapped in a real UA)
  /wget\//,
  /scrapy/,
  /java\/[0-9]/,   // raw Java HttpURLConnection
  /axios\/[0-9]/,  // raw axios without an app-level UA
];

function buildBlockedPatterns(): RegExp[] {
  const extra = process.env.BLOCKED_USER_AGENT_PATTERNS;
  if (!extra) return DEFAULT_BLOCKED_PATTERNS;
  const extras = extra
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => new RegExp(s, "i"));
  return [...DEFAULT_BLOCKED_PATTERNS, ...extras];
}

const BLOCKED_PATTERNS = buildBlockedPatterns();

export function userAgentFilter(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const ua = (req.headers["user-agent"] ?? "").toLowerCase();

  if (!ua) {
    return next(new AppError("Missing User-Agent header", 400, "MISSING_USER_AGENT"));
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(ua)) {
      return next(new AppError("Forbidden", 403, "FORBIDDEN_USER_AGENT"));
    }
  }

  next();
}
