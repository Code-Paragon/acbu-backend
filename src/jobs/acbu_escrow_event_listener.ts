/**
 * Listens for events on acbu_escrow contract and enqueues ACBU_ESCROW_EVENTS.
 */
import {
  eventListener,
  ContractEvent,
} from "../services/stellar/eventListener";
import { contractAddresses } from "../config/contracts";
import { connectRabbitMQ, QUEUES, assertQueueWithDLQ } from "../config/rabbitmq";
import { logger } from "../config/logger";

const ESCROW_EFFECT_TYPES = [
  "contract_credited",
  "contract_debited",
  "contract_effect",
];

export async function startEscrowEventListener(): Promise<void> {
  const contractId = contractAddresses.escrow;
  if (!contractId) {
    logger.info("Escrow event listener skipped: no CONTRACT_ESCROW configured");
    return;
  }

  const handler = async (event: ContractEvent): Promise<void> => {
    try {
      const ch = await connectRabbitMQ();
      await assertQueueWithDLQ(QUEUES.ACBU_ESCROW_EVENTS);
      ch.sendToQueue(
        QUEUES.ACBU_ESCROW_EVENTS,
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
      logger.debug("Escrow event enqueued", {
        type: event.type,
        ledger: event.ledger,
      });
    } catch (e) {
      logger.error("Escrow event enqueue failed", { error: e });
    }
  };

  eventListener.listenToContractEvents(
    contractId,
    ESCROW_EFFECT_TYPES,
    handler,
  );
  logger.info("Escrow event listener registered", {
    contractId,
    effectTypes: ESCROW_EFFECT_TYPES,
  });
}
