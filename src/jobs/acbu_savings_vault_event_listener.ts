/**
 * Listens for events on acbu_savings_vault contract and enqueues ACBU_SAVINGS_VAULT_EVENTS.
 */
import {
  eventListener,
  ContractEvent,
} from "../services/stellar/eventListener";
import { contractAddresses } from "../config/contracts";
import { connectRabbitMQ, QUEUES, assertQueueWithDLQ } from "../config/rabbitmq";
import { logger } from "../config/logger";

const SAVINGS_VAULT_EFFECT_TYPES = [
  "contract_credited",
  "contract_debited",
  "contract_effect",
];

export async function startSavingsVaultEventListener(): Promise<void> {
  const contractId = contractAddresses.savingsVault;
  if (!contractId) {
    logger.info(
      "Savings vault event listener skipped: no CONTRACT_SAVINGS_VAULT configured",
    );
    return;
  }

  const handler = async (event: ContractEvent): Promise<void> => {
    try {
      const ch = await connectRabbitMQ();
      await assertQueueWithDLQ(QUEUES.ACBU_SAVINGS_VAULT_EVENTS);
      ch.sendToQueue(
        QUEUES.ACBU_SAVINGS_VAULT_EVENTS,
        Buffer.from(
          JSON.stringify({
            contractId: event.contractId,
            type: event.type,
            data: event.data,
            ledger: event.ledger,
            timestamp: event.timestamp,
          }),
        ),
        { persistent: true },
      );
      logger.debug("Savings vault event enqueued", {
        type: event.type,
        ledger: event.ledger,
      });
    } catch (e) {
      logger.error("Savings vault event enqueue failed", { error: e });
    }
  };

  eventListener.listenToContractEvents(
    contractId,
    SAVINGS_VAULT_EFFECT_TYPES,
    handler,
  );
  logger.info("Savings vault event listener registered", {
    contractId,
    effectTypes: SAVINGS_VAULT_EFFECT_TYPES,
  });
}
