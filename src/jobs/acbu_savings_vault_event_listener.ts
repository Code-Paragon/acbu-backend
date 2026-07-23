/**
 * Listens for events on acbu_savings_vault contract and enqueues ACBU_SAVINGS_VAULT_EVENTS.
 */
import {
  eventListener,
  ContractEvent,
} from "../services/stellar/eventListener";
import { contractAddresses } from "../config/contracts";
import { logger } from "../config/logger";
import { savingsVaultEventProducer } from "./producers";

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
      const validatedEvent = {
        contractId: event.contractId,
        type: event.type,
        data: event.data || {},
        ledger: event.ledger,
        timestamp: event.timestamp || new Date().toISOString(),
      };

      await savingsVaultEventProducer.publish(validatedEvent);

      logger.debug("Savings vault event enqueued with validation", {
        type: event.type,
        ledger: event.ledger,
      });
    } catch (error) {
      logger.error("Savings vault event enqueue failed", {
        error: error instanceof Error ? error.message : String(error),
        eventType: event.type,
        ledger: event.ledger,
      });
    }
  };

  eventListener.listenToContractEvents(
    contractId,
    SAVINGS_VAULT_EFFECT_TYPES,
    handler,
  );
  logger.info("Savings vault event listener registered with validation", {
    contractId,
    effectTypes: SAVINGS_VAULT_EFFECT_TYPES,
  });
}