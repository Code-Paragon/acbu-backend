import { getHealthReport } from "../src/services/health/healthService";

// --- mock dependencies ---
jest.mock("../src/config/database", () => ({
  prisma: { $queryRaw: jest.fn() },
}));

jest.mock("../src/config/mongodb", () => ({
  getMongoDB: jest.fn(),
}));

jest.mock("../src/config/rabbitmq", () => ({
  getRabbitMQChannel: jest.fn(),
}));

jest.mock("../src/config/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock("../src/services/stellar/eventListener", () => ({
  eventListenerHealth: {
    status: "up",
    lastHealthyAt: Date.now(),
    lastUnhealthyAt: null,
    lastError: null,
    reconnectAttemptsTotal: 0,
    lastReconnectAttemptAt: null,
  },
}));

import { prisma } from "../src/config/database";
import { getMongoDB } from "../src/config/mongodb";
import { getRabbitMQChannel } from "../src/config/rabbitmq";

const mockEventListenerHealth = require("../src/services/stellar/eventListener")
  .eventListenerHealth as {
  status: "up" | "down";
  lastHealthyAt: number | null;
  lastUnhealthyAt: number | null;
  lastError: string | null;
  reconnectAttemptsTotal: number;
  lastReconnectAttemptAt: number | null;
};

const mockPrismaQuery = prisma.$queryRaw as jest.Mock;
const mockGetMongoDB = getMongoDB as jest.Mock;
const mockGetRabbitMQChannel = getRabbitMQChannel as jest.Mock;

// Helper: fake Mongo db with working ping
const healthyMongo = () => ({
  admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockEventListenerHealth.status = "up";
  mockEventListenerHealth.lastHealthyAt = Date.now();
  mockEventListenerHealth.lastUnhealthyAt = null;
  mockEventListenerHealth.lastError = null;
  mockEventListenerHealth.reconnectAttemptsTotal = 0;
  mockEventListenerHealth.lastReconnectAttemptAt = null;
});

describe("getHealthReport", () => {
  it("should return status 'up' when all dependencies are healthy", async () => {
    mockPrismaQuery.mockResolvedValue([{ "?column?": 1 }]);
    mockGetMongoDB.mockReturnValue(healthyMongo());
    mockGetRabbitMQChannel.mockReturnValue({ /* non-null channel */ ack: jest.fn() });

    const report = await getHealthReport();

    expect(report.status).toBe("up");
    expect(report.details.postgres.status).toBe("up");
    expect(report.details.mongodb.status).toBe("up");
    expect(report.details.rabbitmq.status).toBe("up");
    expect(report.details.sorobanEventListener.status).toBe("up");
  });

  it("should return 503-worthy status 'down' when PostgreSQL connection is lost", async () => {
    mockPrismaQuery.mockRejectedValue(new Error("ECONNREFUSED"));
    mockGetMongoDB.mockReturnValue(healthyMongo());
    mockGetRabbitMQChannel.mockReturnValue({ ack: jest.fn() });

    const report = await getHealthReport();

    expect(report.status).toBe("down");
    expect(report.details.postgres.status).toBe("down");
    expect(report.details.postgres.error).toBe("PostgreSQL unreachable");
    expect(report.details.mongodb.status).toBe("up");
    expect(report.details.rabbitmq.status).toBe("up");
    expect(report.details.sorobanEventListener.status).toBe("up");
  });

  it("should return status 'down' when MongoDB is unreachable", async () => {
    mockPrismaQuery.mockResolvedValue([{ "?column?": 1 }]);
    mockGetMongoDB.mockImplementation(() => {
      throw new Error("MongoDB not connected");
    });
    mockGetRabbitMQChannel.mockReturnValue({ ack: jest.fn() });

    const report = await getHealthReport();

    expect(report.status).toBe("down");
    expect(report.details.mongodb.status).toBe("down");
    expect(report.details.sorobanEventListener.status).toBe("up");
  });

  it("should return status 'down' when RabbitMQ channel is unavailable", async () => {
    mockPrismaQuery.mockResolvedValue([{ "?column?": 1 }]);
    mockGetMongoDB.mockReturnValue(healthyMongo());
    mockGetRabbitMQChannel.mockReturnValue(null);

    const report = await getHealthReport();

    expect(report.status).toBe("down");
    expect(report.details.rabbitmq.status).toBe("down");
    expect(report.details.sorobanEventListener.status).toBe("up");
  });

  it("should return status 'down' when Soroban event listener is unhealthy", async () => {
    mockPrismaQuery.mockResolvedValue([{ "?column?": 1 }]);
    mockGetMongoDB.mockReturnValue(healthyMongo());
    mockGetRabbitMQChannel.mockReturnValue({ ack: jest.fn() });
    mockEventListenerHealth.status = "down";
    mockEventListenerHealth.lastError = "Event listener disconnected";

    const report = await getHealthReport();

    expect(report.status).toBe("down");
    expect(report.details.sorobanEventListener.status).toBe("down");
    expect(report.details.sorobanEventListener.error).toBe(
      "Event listener disconnected",
    );
  });

  it("should include timestamp and uptime in the report", async () => {
    mockPrismaQuery.mockResolvedValue([{ "?column?": 1 }]);
    mockGetMongoDB.mockReturnValue(healthyMongo());
    mockGetRabbitMQChannel.mockReturnValue({ ack: jest.fn() });

    const report = await getHealthReport();

    expect(report.timestamp).toBeDefined();
    expect(typeof report.uptime).toBe("number");
  });
});
