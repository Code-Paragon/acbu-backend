/**
 * Listens for BurnEvent (contract_debited) on acbu_burning contract and enqueues WITHDRAWAL_PROCESSING jobs.
 */
import {
  eventListener,
  ContractEvent,
} from "../services/stellar/eventListener";
import { getContractAddresses } from "../config/contracts";
import { enqueueWithdrawalProcessing } from "./withdrawalProcessingJob";
import { logger } from "../config/logger";
import { prisma } from "../config/database";
import {
  resolveTxHash,
  verifyTxHashOnChain,
} from "../services/stellar/txHashValidation";

const BURN_EFFECT_TYPES = ["contract_debited", "contract_effect"];

async function findTransactionByBlockchainHash(
  txHash: string,
): Promise<string | null> {
  const tx = await prisma.transaction.findFirst({
    where: {
      type: "burn",
      blockchainTxHash: txHash,
      status: { in: ["pending", "processing"] },
    },
    select: { id: true },
  });
  return tx?.id ?? null;
}

export async function startBurnEventListener(): Promise<void> {
  const burningContractId = getContractAddresses().burning;
  if (!burningContractId) {
    logger.info("Burn event listener skipped: no CONTRACT_BURNING configured");
    return;
  }

  const handler = async (event: ContractEvent): Promise<void> => {
    const data = (event.data || {}) as Record<string, unknown>;
    const { txHash: resolvedHash, verified } = await resolveTxHash(data);
    if (resolvedHash === null) {
      logger.debug("Burn event skipped: no verifiable tx hash found", {
        ledger: event.ledger,
      });
      return;
    }
    if (!verified) {
      logger.warn("Burn event: rejecting event with unverified tx hash", {
        txHash: resolvedHash,
        ledger: event.ledger,
      });
      return;
    }

    const onChainValid = await verifyTxHashOnChain(resolvedHash);
    if (!onChainValid) {
      logger.warn("Burn event: rejecting event — tx hash not found on-chain", {
        txHash: resolvedHash,
        ledger: event.ledger,
      });
      return;
    }

    const transactionId = await findTransactionByBlockchainHash(resolvedHash);
    if (!transactionId) {
      logger.debug(
        "Burn event: no pending/processing burn transaction for hash",
        { txHash: resolvedHash },
      );
      return;
    }
    await enqueueWithdrawalProcessing({ transactionId, txHash: resolvedHash });
  };

  eventListener.listenToContractEvents(
    burningContractId,
    BURN_EFFECT_TYPES,
    handler,
  );
  logger.info("Burn event listener registered", {
    contractId: burningContractId,
    effectTypes: BURN_EFFECT_TYPES,
  });
}
