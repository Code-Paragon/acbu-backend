import { MintingService } from "../src/services/contracts/acbuMinting.service";
import { contractClient } from "../src/services/stellar/contractClient";
import { stellarClient } from "../src/services/stellar/client";

jest.mock("../src/services/stellar/contractClient", () => ({
  contractClient: { invokeContract: jest.fn() },
  ContractClient: { toScVal: jest.fn(), fromScVal: jest.fn() },
}));

jest.mock("../src/services/stellar/client", () => ({
  stellarClient: { getKeypair: jest.fn(() => ({ publicKey: () => "test-pub-key" })) },
}));

// Mock the shared database singleton — the one the service now imports.
const mockTransactionUpdate = jest.fn();
jest.mock("../src/config/database", () => ({
  prisma: {
    transaction: { update: mockTransactionUpdate },
  },
}));

describe("MintingService Compensation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("marks tx FAILED if stellar throws", async () => {
    const service = new MintingService("contract-id");
    (contractClient.invokeContract as jest.Mock).mockRejectedValue(new Error("Stellar Fail"));

    await expect(
      service.mintFromUsdc({
        user: "user",
        usdcAmount: "100",
        recipient: "rec",
        txId: "123",
      } as any),
    ).rejects.toThrow("Stellar Fail");

    expect(mockTransactionUpdate).toHaveBeenCalledWith({
      where: { id: "123" },
      data: { status: "FAILED" },
    });
  });
});
