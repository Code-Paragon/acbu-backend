import { type Server } from "http";
import { logger } from "./config/logger";
import { disconnectMongoDB } from "./config/mongodb";
import { disconnectRabbitMQ } from "./config/rabbitmq";
import { stopMemoryMonitor } from "./utils/memoryMonitor";

type AppServer = Server & { closeIdleConnections?: () => void };
let httpServer: AppServer | null = null;
let memoryMonitorHandle: NodeJS.Timeout | null = null;

export const setHttpServer = (server: AppServer | null): void => {
  httpServer = server;
};

export const setMemoryMonitorHandle = (handle: NodeJS.Timeout): void => {
  memoryMonitorHandle = handle;
};

const closeServer = async (): Promise<void> => {
  if (!httpServer) {
    return;
  }

  if (typeof httpServer.closeIdleConnections === "function") {
    try {
      httpServer.closeIdleConnections();
    } catch (error) {
      logger.warn("Failed to close idle HTTP connections", error);
    }
  }

  await new Promise<void>((resolve, reject) => {
    httpServer?.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  httpServer = null;
};

export const shutdown = async (): Promise<void> => {
  logger.info("Shutting down gracefully...");
  if (memoryMonitorHandle) stopMemoryMonitor(memoryMonitorHandle);
  await closeServer();
  await disconnectMongoDB();
  await disconnectRabbitMQ();
};

let isShuttingDown = false;
const handleTermination = async (): Promise<void> => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  try {
    await shutdown();
  } catch (error) {
    logger.error("Graceful shutdown failed", error);
  } finally {
    process.exit(0);
  }
};

export const registerGracefulShutdown = (): void => {
  process.on("SIGTERM", handleTermination);
  process.on("SIGINT", handleTermination);
};
