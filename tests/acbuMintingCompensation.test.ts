import { MintingService } from "../src/services/contracts/acbuMinting.service";
import { contractClient } from "../src/stellar/contractClient";
import { stellarClient } from "../src/stellar/client";
import { PrismaClient } from "@prisma/client";

jest.mock("../src/stellar/contractClient", () => ({
  contractClient: { invokeContract: jest.fn() },
  ContractClient: { toScVal: jest.fn(), fromScVal: jest.fn() }
}));

jest.mock("../src/stellar/client", () => ({
  stellarClient: { getKeypair: jest.fn(() => ({ publicKey: () => "test-pub-key" })) }
}));

jest.mock("@prisma/client", () => {
  const mPrisma = { transaction: { update: jest.fn() } };
  return { PrismaClient: jest.fn(() => mPrisma) };
});

describe("MintingService Compensation", () => {
  it("marks tx FAILED if stellar throws", async () => {
    const service = new MintingService("contract-id");
    (contractClient.invokeContract as jest.Mock).mockRejectedValue(new Error("Stellar Fail"));
    
    const prisma = new PrismaClient();
    
    try {
      await service.mintFromUsdc({
        user: "user", usdcAmount: "100", recipient: "rec", txId: "123"
      } as any);
    } catch (e) {}

    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: "123" },
      data: { status: "FAILED" }
    });
  });
});
