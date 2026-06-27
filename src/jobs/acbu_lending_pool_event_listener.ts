/**
 * Listens for events on acbu_lending_pool contract and enqueues ACBU_LENDING_POOL_EVENTS.
 */
import {
  eventListener,
  ContractEvent,
} from "../services/stellar/eventListener";
import { contractAddresses } from "../config/contracts";
import { logger } from "../config/logger";
import { lendingPoolEventProducer } from "./producers";

const LENDING_POOL_EFFECT_TYPES = [
  "contract_credited",
  "contract_debited",
  "contract_effect",
];

export async function startLendingPoolEventListener(): Promise<void> {
  const contractId = contractAddresses.lendingPool;
  if (!contractId) {
    logger.info(
      "Lending pool event listener skipped: no CONTRACT_LENDING_POOL configured",
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

      await lendingPoolEventProducer.publish(validatedEvent);

      logger.debug("Lending pool event enqueued with validation", {
        type: event.type,
        ledger: event.ledger,
      });
    } catch (error) {
      logger.error("Lending pool event enqueue failed", {
        error: error instanceof Error ? error.message : String(error),
        eventType: event.type,
        ledger: event.ledger,
      });
    }
  };

  eventListener.listenToContractEvents(
    contractId,
    LENDING_POOL_EFFECT_TYPES,
    handler,
  );
  logger.info("Lending pool event listener registered with validation", {
    contractId,
    effectTypes: LENDING_POOL_EFFECT_TYPES,
  });
}