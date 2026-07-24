/**
 * Listens for events on acbu_escrow contract and enqueues ACBU_ESCROW_EVENTS.
 */
import {
  eventListener,
  ContractEvent,
} from "../services/stellar/eventListener";
import { getContractAddresses } from "../config/contracts";
import { logger } from "../config/logger";
import { escrowEventProducer } from "./producers";

const ESCROW_EFFECT_TYPES = [
  "contract_credited",
  "contract_debited",
  "contract_effect",
];

export async function startEscrowEventListener(): Promise<void> {
  const contractId = getContractAddresses().escrow;
  if (!contractId) {
    logger.info("Escrow event listener skipped: no CONTRACT_ESCROW configured");
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

      // Use producer with validation
      await escrowEventProducer.publish(validatedEvent);

      logger.debug("Escrow event enqueued with validation", {
        type: event.type,
        ledger: event.ledger,
      });
    } catch (error) {
      logger.error("Escrow event enqueue failed", {
        error: error instanceof Error ? error.message : String(error),
        eventType: event.type,
        ledger: event.ledger,
      });
    }
  };

  eventListener.listenToContractEvents(
    contractId,
    ESCROW_EFFECT_TYPES,
    handler,
  );
  logger.info("Escrow event listener registered with validation", {
    contractId,
    effectTypes: ESCROW_EFFECT_TYPES,
  });
}