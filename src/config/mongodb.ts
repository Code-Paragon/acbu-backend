import { MongoClient, Db } from "mongodb";
import { config } from "./env";
import { logger } from "./logger";

let client: MongoClient | null = null;
let db: Db | null = null;

function sanitizeMongoUri(uri: string): string {
  return uri.replace(/\/\/[^:@]+:[^@]+@/, "//***:***@");
}

export async function connectMongoDB(): Promise<Db> {
  if (db) return db;

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      client = new MongoClient(config.mongodbUri);
      await client.connect();
      db = client.db();
      logger.info("MongoDB connected successfully");
      break;
    } catch (error) {
      lastError = error;
      client = null;
      if (attempt === MAX_RETRIES) break;
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      logger.warn(`MongoDB connection attempt ${attempt} failed, retrying in ${delay}ms`, { error });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  if (!db) {
    logger.error("Failed to connect to MongoDB after retries", { error: lastError });
    throw lastError;
  }

  const collection = db.collection("cache");

  const indexConfigs: Array<{
    spec: Record<string, 1>;
    options: { name: string; expireAfterSeconds?: number };
    critical: boolean;
  }> = [
    {
      spec: { key: 1, expiresAt: 1 },
      options: { name: "idx_key_expiresAt" },
      critical: false,
    },
    {
      spec: { expiresAt: 1 },
      options: { name: "idx_expiresAt_ttl", expireAfterSeconds: 0 },
      critical: true,
    },
  ];

  const results = await Promise.allSettled(
    indexConfigs.map((idx) => collection.createIndex(idx.spec, idx.options)),
  );

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const cfg = indexConfigs[i];
      const logData = { indexName: cfg.options.name, error: result.reason };
      if (cfg.critical) {
        logger.error("Critical index creation failed", logData);
      } else {
        logger.warn("Index creation warning", logData);
      }
    }
  });

    return db;
  } catch (error) {
    logger.error("Failed to connect to MongoDB", {
      uri: sanitizeMongoUri(config.mongodbUri),
      error,
    });
    throw error;
  }
}

export async function disconnectMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info("MongoDB disconnected");
  }
}

export function getMongoDB(): Db {
  if (!db) {
    throw new Error("MongoDB not connected. Call connectMongoDB() first.");
  }
  return db;
}
