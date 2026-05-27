/// <reference types="jest" />
import { processInvestmentWithdrawalAvailability } from "../src/jobs/investmentWithdrawalJob";

// --- mock dependencies ---
jest.mock("../src/config/database", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    investmentWithdrawalRequest: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock("../src/config/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn() },
}));

jest.mock("../src/services/investment/withdrawalNotificationService", () => ({
  publishInvestmentWithdrawalReady: jest.fn(),
}));

import { prisma } from "../src/config/database";
import { publishInvestmentWithdrawalReady } from "../src/services/investment/withdrawalNotificationService";
import { Decimal } from "@prisma/client/runtime/library";

const mockQueryRaw = prisma.$queryRaw as jest.Mock;
const mockFindMany = prisma.investmentWithdrawalRequest.findMany as jest.Mock;
const mockUpdate = prisma.investmentWithdrawalRequest.update as jest.Mock;
const mockPublish = publishInvestmentWithdrawalReady as jest.Mock;
const trustedNow = new Date("2026-05-27T12:00:00.000Z");

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryRaw.mockResolvedValue([{ trustedNow }]);
});

describe("processInvestmentWithdrawalAvailability", () => {
  it("should notify user when user withdrawal becomes available", async () => {
    const userId = "user-123";
    const amountAcbu = new Decimal("100.00");
    const now = new Date();

    mockFindMany.mockResolvedValue([
      {
        id: "request-1",
        userId,
        organizationId: null,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
    ]);

    mockUpdate.mockResolvedValue({});

    await processInvestmentWithdrawalAvailability();

    expect(mockPublish).toHaveBeenCalledWith(
      userId,
      amountAcbu.toNumber(),
      null,
      trustedNow,
    );
  });

  it("should notify organization admins when org withdrawal becomes available", async () => {
    const organizationId = "org-123";
    const amountAcbu = new Decimal("100.00");
    const now = new Date();

    mockFindMany.mockResolvedValue([
      {
        id: "request-2",
        userId: null,
        organizationId,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
    ]);

    mockUpdate.mockResolvedValue({});

    await processInvestmentWithdrawalAvailability();

    expect(mockPublish).toHaveBeenCalledWith(
      null,
      amountAcbu.toNumber(),
      organizationId,
      trustedNow,
    );
  });

  it("should mark withdrawal as available with notifiedAt timestamp", async () => {
    const userId = "user-456";
    const amountAcbu = new Decimal("50.00");
    const requestId = "request-3";
    const now = new Date();

    mockFindMany.mockResolvedValue([
      {
        id: requestId,
        userId,
        organizationId: null,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
    ]);

    mockUpdate.mockResolvedValue({});

    await processInvestmentWithdrawalAvailability();

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: requestId },
      data: { status: "available", notifiedAt: trustedNow },
    });
  });

  it("should query ready withdrawals using the database clock", async () => {
    mockFindMany.mockResolvedValue([]);

    await processInvestmentWithdrawalAvailability();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["requested", "processing"] },
        availableAt: { lte: trustedNow },
      },
      take: 100,
    });
  });

  it("should skip notifications if both userId and organizationId are null", async () => {
    const amountAcbu = new Decimal("100.00");
    const now = new Date();

    mockFindMany.mockResolvedValue([
      {
        id: "request-4",
        userId: null,
        organizationId: null,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
    ]);

    mockUpdate.mockResolvedValue({});

    await processInvestmentWithdrawalAvailability();

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("should handle multiple withdrawal requests in one run", async () => {
    const user1Id = "user-111";
    const org1Id = "org-111";
    const amountAcbu = new Decimal("100.00");
    const now = new Date();

    mockFindMany.mockResolvedValue([
      {
        id: "request-5",
        userId: user1Id,
        organizationId: null,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
      {
        id: "request-6",
        userId: null,
        organizationId: org1Id,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
    ]);

    mockUpdate.mockResolvedValue({});

    await processInvestmentWithdrawalAvailability();

    expect(mockPublish).toHaveBeenCalledTimes(2);
    expect(mockPublish).toHaveBeenCalledWith(
      user1Id,
      amountAcbu.toNumber(),
      null,
      trustedNow,
    );
    expect(mockPublish).toHaveBeenCalledWith(
      null,
      amountAcbu.toNumber(),
      org1Id,
      trustedNow,
    );
  });

  it("should continue processing when one request fails", async () => {
    const userId = "user-222";
    const orgId = "org-222";
    const amountAcbu = new Decimal("100.00");
    const now = new Date();

    mockFindMany.mockResolvedValue([
      {
        id: "request-7",
        userId,
        organizationId: null,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
      {
        id: "request-8",
        userId: null,
        organizationId: orgId,
        status: "requested",
        amountAcbu,
        availableAt: new Date(now.getTime() - 1000),
      },
    ]);

    mockUpdate
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("Update failed"));

    await processInvestmentWithdrawalAvailability();

    // Should call publish only for the first request that succeeded
    // Second request's publish is not called because update failed
    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish).toHaveBeenCalledWith(
      userId,
      amountAcbu.toNumber(),
      null,
      trustedNow,
    );
  });
});
