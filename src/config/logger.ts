import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";
import { config } from "./env";
import { FinancialLogPayload, FinancialEventEnvironment } from "../types/logging";
import { redactFormat, redactPii } from "./logRedaction";

export { redactFormat, redactLogValue, redactPii } from "./logRedaction";

export type LogLevel = "error" | "warn" | "info" | "http" | "verbose" | "debug" | "silly";

export function resolveTransportLogLevels(options: {
  nodeEnv: string;
  logLevel: LogLevel;
  logConsoleLevel?: LogLevel;
  logFileLevel?: LogLevel;
}): { console: LogLevel; file: LogLevel; error: LogLevel } {
  const isProduction = options.nodeEnv === "production";

  return {
    console: options.logConsoleLevel ?? (isProduction ? "info" : options.logLevel),
    file: options.logFileLevel ?? (isProduction ? "info" : options.logLevel),
    error: "error",
  };
}

const transportLevels = resolveTransportLogLevels({
  nodeEnv: config.nodeEnv,
  logLevel: config.logLevel as LogLevel,
  logConsoleLevel: config.logConsoleLevel as LogLevel,
  logFileLevel: config.logFileLevel as LogLevel,
});

const logDir = path.dirname(config.logFile);

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const CARD_NUMBER_PATTERN = /\b\d{13,19}\b/g;

const SENSITIVE_KEY_PATTERN =
  /pass(?:word|code|wd)|secret|token|authorization|api[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret[_-]?key|secret[_-]?access[_-]?key|\bpin\b|cvv|cvc|ssn|bvn|credit[_-]?card|card[_-]?number|cookie|mnemonic|\bseed\b|\bjwt\b/i;

const REDACTED = "[REDACTED]";

function redactPii(value: string): string {
  return value.replace(CARD_NUMBER_PATTERN, REDACTED);
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

/** Recursively redact sensitive keys and card-like numbers from log values. */
export function redactLogValue(
  value: unknown,
  key?: string,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (key !== undefined && isSensitiveKey(key)) {
    return REDACTED;
  }
  if (typeof value === "string") {
    return redactPii(value);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, undefined, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
    result[childKey] = redactLogValue(childValue, childKey, seen);
  }
  return result;
}

/** Winston format: apply PII/secret redaction to every log info object. */
export const redactFormat = winston.format((info) => {
  const seen = new WeakSet<object>();
  for (const key of Object.keys(info)) {
    if (key === "level") continue;
    (info as Record<string, unknown>)[key] = redactLogValue(
      (info as Record<string, unknown>)[key],
      key,
      seen,
    );
  }
  return info;
});

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  redactFormat(),
  winston.format.json(),
);

const consoleFormat = winston.format.combine(
  redactFormat(),
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  }),
);

const isProduction = config.nodeEnv === "production";

export const logger = winston.createLogger({
  level: config.logLevel,
  format: logFormat,
  defaultMeta: { service: "acbu-backend" },
  transports: [
    new winston.transports.Console({
      level: transportLevels.console,
      format: isProduction
        ? consoleFormat
        : winston.format.combine(
            redactFormat(),
            winston.format.colorize(),
            winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
            winston.format.simple(),
          ),
    }),
    // Rotating error log: daily rotation, 14-day retention, 100 MB max per file
    new DailyRotateFile({
      dirname: logDir,
      filename: "error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: "14d",
      maxSize: "100m",
      zippedArchive: true,
    }),
    // Rotating combined log: daily rotation, 30-day retention, 100 MB max per file
    new DailyRotateFile({
      dirname: logDir,
      filename: "combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: transportLevels.file,
      maxFiles: "30d",
      maxSize: "100m",
      zippedArchive: true,
    }),
  ],
});

// Structured Financial Logging

const REQUIRED_FIELDS: (keyof FinancialLogPayload)[] = [
  "event",
  "amount",
  "currency",
  "userId",
  "accountId",
  "idempotencyKey",
  "transactionId",
  "status",
  "correlationId",
];

export function logFinancialEvent(payload: Omit<FinancialLogPayload, "timestamp" | "environment"> & Partial<Pick<FinancialLogPayload, "timestamp" | "environment">>): void {
  // Apply defaults (caller-supplied values take precedence)
  const entry: FinancialLogPayload = {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
    environment: payload.environment ?? (config.nodeEnv as FinancialEventEnvironment),
  };

  // Redact PII in string fields
  const mutableEntry = entry as unknown as Record<string, unknown>;
  for (const key of Object.keys(mutableEntry)) {
    if (typeof mutableEntry[key] === "string") {
      mutableEntry[key] = redactPii(mutableEntry[key] as string);
    }
  }

  // Validate required fields
  const missing = REQUIRED_FIELDS.filter(
    (f) => entry[f] === undefined || entry[f] === null || entry[f] === "",
  );
  if (missing.length > 0) {
    logger.warn("logFinancialEvent: missing required fields", { missing, partial: entry });
    return;
  }

  // Select log level by status
  switch (entry.status) {
    case "failed":
      logger.error("financial_event", entry);
      break;
    case "reversed":
      logger.warn("financial_event", entry);
      break;
    default:
      logger.info("financial_event", entry);
  }
}
