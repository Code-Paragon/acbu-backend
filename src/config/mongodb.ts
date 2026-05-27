import { MongoClient, Db } from "mongodb";
import { config } from "./env";
import { logger } from "./logger";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongoDB(): Promise<Db> {
  if (db) return db;

  try {
    client = new MongoClient(config.mongodbUri);
    await client.connect();
    db = client.db();

    logger.info("MongoDB connected successfully");

    const collection = db.collection("cache");

    // Define index configurations
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
        critical: true, // TTL failure impacts security logic
      },
    ];

    // Execute all index creations regardless of individual failures
    const results = await Promise.allSettled(
      indexConfigs.map((idx) => collection.createIndex(idx.spec, idx.options)),
    );

    // Evaluate results
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        const config = indexConfigs[i];
        const logData = {
          indexName: config.options.name,
          error: result.reason,
        };

        if (config.critical) {
          // TTL failures are logged as errors because they break brute-force protection
          logger.error("Critical index creation failed", logData);
        } else {
          logger.warn("Index creation warning", logData);
        }
      }
    });

    return db;
  } catch (error) {
    logger.error("Failed to connect to MongoDB", { error });
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
