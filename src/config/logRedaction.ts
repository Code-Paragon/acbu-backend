import winston from "winston";

const CARD_NUMBER_PATTERN = /\b\d{13,19}\b/g;

const SENSITIVE_KEY_PATTERN =
  /pass(?:word|code|wd)|secret|token|authorization|api[_-]?key|private[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret[_-]?key|secret[_-]?access[_-]?key|\bpin\b|cvv|cvc|ssn|bvn|credit[_-]?card|card[_-]?number|cookie|mnemonic|\bseed\b|\bjwt\b/i;

const REDACTED = "[REDACTED]";

export function redactPii(value: string): string {
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
