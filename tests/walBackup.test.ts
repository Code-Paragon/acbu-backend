/**
 * #381 – WAL backup configuration guard
 *
 * Verifies that connectWithRetry() refuses to start in production when
 * PG_WAL_BACKUP_CONFIGURED is not "true", and proceeds normally otherwise.
 */

const REQUIRED_ENV = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  MONGODB_URI: "mongodb://localhost:27017/db",
  RABBITMQ_URL: "amqp://localhost:5672",
  JWT_SECRET: "test-secret",
  PRISMA_ACCELERATE_URL: "prisma://accelerate.prisma-data.net/?api_key=test",
  CORS_ORIGIN: "https://app.acbu.io",
};

const mockPrismaClient = () => ({
  $use: jest.fn(),
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn(),
  $on: jest.fn(),
  $extends: jest.fn().mockReturnThis(),
});

describe("#381 WAL backup guard", () => {
  const ORIGINAL = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL, ...REQUIRED_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL;
  });

  it("throws in production when PG_WAL_BACKUP_CONFIGURED is not set", async () => {
    delete process.env.PG_WAL_BACKUP_CONFIGURED;

    // Mock PrismaClient so no real DB connection is attempted
    jest.mock("@prisma/client", () => ({
      PrismaClient: jest.fn().mockImplementation(mockPrismaClient),
      Prisma: { PrismaClientKnownRequestError: class {} },
    }));
    jest.mock("@prisma/extension-accelerate", () => ({
      withAccelerate: jest.fn(() => ({})),
    }));

    const { connectWithRetry } = require("../src/config/database");
    await expect(connectWithRetry()).rejects.toThrow(/WAL backup is not configured/);
  });

  it("throws in production when PG_WAL_BACKUP_CONFIGURED=false", async () => {
    process.env.PG_WAL_BACKUP_CONFIGURED = "false";

    jest.mock("@prisma/client", () => ({
      PrismaClient: jest.fn().mockImplementation(mockPrismaClient),
      Prisma: { PrismaClientKnownRequestError: class {} },
    }));
    jest.mock("@prisma/extension-accelerate", () => ({
      withAccelerate: jest.fn(() => ({})),
    }));

    const { connectWithRetry } = require("../src/config/database");
    await expect(connectWithRetry()).rejects.toThrow(/WAL backup is not configured/);
  });

  it("connects successfully in production when PG_WAL_BACKUP_CONFIGURED=true", async () => {
    process.env.PG_WAL_BACKUP_CONFIGURED = "true";
    process.env.PG_WAL_BACKUP_PROVIDER = "pgbackrest";

    jest.mock("@prisma/client", () => ({
      PrismaClient: jest.fn().mockImplementation(mockPrismaClient),
      Prisma: { PrismaClientKnownRequestError: class {} },
    }));
    jest.mock("@prisma/extension-accelerate", () => ({
      withAccelerate: jest.fn(() => ({})),
    }));

    const { connectWithRetry } = require("../src/config/database");
    await expect(connectWithRetry()).resolves.toBeUndefined();
  });

  it("does not throw in development when PG_WAL_BACKUP_CONFIGURED is not set", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.PG_WAL_BACKUP_CONFIGURED;
    delete process.env.PRISMA_ACCELERATE_URL; // not required in dev

    jest.mock("@prisma/client", () => ({
      PrismaClient: jest.fn().mockImplementation(mockPrismaClient),
      Prisma: { PrismaClientKnownRequestError: class {} },
    }));
    jest.mock("@prisma/extension-accelerate", () => ({
      withAccelerate: jest.fn(() => ({})),
    }));

    const { connectWithRetry } = require("../src/config/database");
    await expect(connectWithRetry()).resolves.toBeUndefined();
  });
});
