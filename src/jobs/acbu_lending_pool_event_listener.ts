/**
 * Listens for events on acbu_lending_pool contract and enqueues ACBU_LENDING_POOL_EVENTS.
 */
import {
  eventListener,
  ContractEvent,
} from "../services/stellar/eventListener";
import { contractAddresses } from "../config/contracts";
import { connectRabbitMQ, QUEUES, assertQueueWithDLQ } from "../config/rabbitmq";
import { logger } from "../config/logger";

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
      const ch = await connectRabbitMQ();
      await assertQueueWithDLQ(QUEUES.ACBU_LENDING_POOL_EVENTS);
      ch.sendToQueue(
        QUEUES.ACBU_LENDING_POOL_EVENTS,
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
      logger.debug("Lending pool event enqueued", {
        type: event.type,
        ledger: event.ledger,
      });
    } catch (e) {
      logger.error("Lending pool event enqueue failed", { error: e });
    }
  };

  eventListener.listenToContractEvents(
    contractId,
    LENDING_POOL_EFFECT_TYPES,
    handler,
  );
  logger.info("Lending pool event listener registered", {
    contractId,
    effectTypes: LENDING_POOL_EFFECT_TYPES,
  });
}
