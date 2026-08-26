import { contractClient, ContractClient } from "../stellar/contractClient";
import { stellarClient } from "../stellar/client";
import { logger } from "../../config/logger";

export interface RedeemSingleParams {
  user: string;
  recipient: string;
  acbuAmount: string; // Amount in smallest unit (7 decimals)
  currency: string; // Currency code (NGN, KES, RWF)
}

export interface RedeemBasketParams {
  user: string;
  recipient: string;
  acbuAmount: string;
}

export class BurningService {
  private contractId: string;
  private contractClient: ContractClient;

  constructor(contractId: string) {
    this.contractId = contractId;
    this.contractClient = contractClient;
  }

  /**
   * Redeem ACBU for single currency
   */
  async redeemSingle(params: RedeemSingleParams): Promise<{
    transactionHash: string;
    localAmount: string;
  }> {
    try {
      logger.info("Redeeming ACBU for single currency", params);

      const sourceAccount = stellarClient.getKeypair()?.publicKey();
      if (!sourceAccount) {
        throw new Error("No source account available");
      }

      // Build function arguments: [user, recipient, acbu_amount, currency]
      const args = [
        ContractClient.toScVal(params.user),
        ContractClient.toScVal(params.recipient),
        ContractClient.toScVal(BigInt(params.acbuAmount)),
        ContractClient.toScVal(params.currency),
      ];

      // Invoke contract
      const result = await this.contractClient.invokeContract({
        contractId: this.contractId,
        functionName: "redeem_single",
        args,
        sourceAccount,
      });

      // Parse result (local currency amount)
      const localAmount = ContractClient.fromScVal(result.result);

      logger.info("Redemption successful", {
        transactionHash: result.transactionHash,
        localAmount: localAmount.toString(),
      });

      return {
        transactionHash: result.transactionHash,
        localAmount: localAmount.toString(),
      };
    } catch (error) {
      logger.error("Failed to redeem single", { params, error });
      throw error;
    }
  }

  /**
   * Redeem ACBU for proportional basket
   */
  async redeemBasket(params: RedeemBasketParams): Promise<{
    transactionHash: string;
    localAmounts: string[];
  }> {
    try {
      logger.info("Redeeming ACBU for basket", params);

      const sourceAccount = stellarClient.getKeypair()?.publicKey();
      if (!sourceAccount) {
        throw new Error("No source account available");
      }

      // Build function arguments: [user, recipient, acbu_amount]
      const args = [
        ContractClient.toScVal(params.user),
        ContractClient.toScVal(params.recipient),
        ContractClient.toScVal(BigInt(params.acbuAmount)),
      ];

      // Invoke contract
      const result = await this.contractClient.invokeContract({
        contractId: this.contractId,
        functionName: "redeem_basket",
        args,
        sourceAccount,
      });

      // Parse result (array of local amounts)
      const parsedResult = ContractClient.fromScVal(result.result);
      if (!Array.isArray(parsedResult)) {
        throw new Error("Invalid redeem_basket result: expected array");
      }
      const localAmounts = parsedResult.map((amount: unknown) => String(amount));

      logger.info("Basket redemption successful", {
        transactionHash: result.transactionHash,
        localAmounts,
      });

      return {
        transactionHash: result.transactionHash,
        localAmounts,
      };
    } catch (error) {
      logger.error("Failed to redeem basket", { params, error });
      throw error;
    }
  }

  /**
   * Get current fee rate
   */
  async getFeeRate(): Promise<number> {
    try {
      const result = await this.contractClient.readContract(this.contractId, "get_fee_rate", []);

      const feeRate = ContractClient.fromScVal(result);
      return Number(feeRate);
    } catch (error) {
      logger.error("Failed to get fee rate", { error });
      throw error;
    }
  }

  /**
   * Check if contract is paused
   */
  async isPaused(): Promise<boolean> {
    try {
      const result = await this.contractClient.readContract(this.contractId, "is_paused", []);

      return ContractClient.fromScVal(result) as boolean;
    } catch (error) {
      logger.error("Failed to check pause status", { error });
      throw error;
    }
  }
}
