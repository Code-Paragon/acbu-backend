/**
 * Idempotency store backed by MongoDB with a configurable TTL (#419).
 *
 * On first call  → acquires the key (returns null).
 * On repeat call → returns the previously stored result.
 * After TTL      → MongoDB automatically deletes the document via a TTL index
 *                  (create the index once with `ensureIndex()`).
 */
import { getMongoDB } from "../../config/mongodb";
import { logger } from "../../config/logger";

const COLLECTION = "idempotency_keys";
const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export interface IdempotencyRecord<T = unknown> {
  key: string;
  result: T;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Ensure the TTL index exists. Call once at startup (idempotent).
 */
export async function ensureIdempotencyIndex(): Promise<void> {
  try {
    const db = getMongoDB();
    await db.collection(COLLECTION).createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, background: true },
    );
    await db.collection(COLLECTION).createIndex(
      { key: 1 },
      { unique: true, background: true },
    );
  } catch (err) {
    logger.warn("Failed to create idempotency indexes", { err });
  }
}

/**
 * Attempt to acquire an idempotency key.
 * Returns null if this is the first request (caller should proceed and call `resolve`).
 * Returns the stored result if the key already exists.
 */
export async function acquireIdempotencyKey<T>(
  key: string,
  _ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<T | null> {
  try {
    const db = getMongoDB();
    const doc = await db.collection<IdempotencyRecord<T>>(COLLECTION).findOne({ key });
    if (doc) {
      return doc.result;
    }
    return null;
  } catch (err) {
    logger.warn("idempotencyStore.acquire failed; proceeding without lock", { key, err });
    return null;
  }
}

/**
 * Store the result for an idempotency key after successful processing.
 */
export async function resolveIdempotencyKey<T>(
  key: string,
  result: T,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  try {
    const db = getMongoDB();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    await db.collection<IdempotencyRecord<T>>(COLLECTION).updateOne(
      { key },
      { $setOnInsert: { key, result, createdAt: now, expiresAt } },
      { upsert: true },
    );
  } catch (err) {
    logger.warn("idempotencyStore.resolve failed; result not cached", { key, err });
  }
}
