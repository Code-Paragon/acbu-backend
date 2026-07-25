import { prisma } from "../../config/database";
import { getInvestmentWithdrawalTiming } from "./withdrawalTimingService";

jest.mock("../../config/database", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    investmentWithdrawalRequest: {
      findMany: jest.fn(),
    },
  },
}));

const mockQueryRaw = prisma.$queryRaw as jest.Mock;

describe("getInvestmentWithdrawalTiming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps withdrawal timing from the trusted database clock row", async () => {
    const requestedAt = new Date("2026-05-15T09:30:00.000Z");
    const availableAt = new Date("2026-05-16T09:30:00.000Z");
    mockQueryRaw.mockResolvedValue([
      {
        requestedAt,
        availableAt,
        businessCalendarDay: 15,
      },
    ]);

    await expect(getInvestmentWithdrawalTiming()).resolves.toEqual({
      requestedAt,
      availableAt,
      businessCalendarDay: 15,
      isBusinessWithdrawalAllowedDate: true,
    });
  });

  it("passes the timezone to raw SQL as a bound parameter", async () => {
    const requestedAt = new Date("2026-05-15T09:30:00.000Z");
    const availableAt = new Date("2026-05-16T09:30:00.000Z");
    mockQueryRaw.mockResolvedValue([
      {
        requestedAt,
        availableAt,
        businessCalendarDay: 15,
      },
    ]);

    await getInvestmentWithdrawalTiming("Africa/Lagos");

    const query = mockQueryRaw.mock.calls[0]?.[0] as {
      strings: string[];
      values: unknown[];
    };
    const queryText = query.strings.join("");

    expect(query.values).toContain("Africa/Lagos");
    expect(queryText).toContain("AT TIME ZONE ");
    expect(queryText).not.toContain("Africa/Lagos");
    expect(queryText).not.toContain("'Africa/Lagos'");
  });
});
