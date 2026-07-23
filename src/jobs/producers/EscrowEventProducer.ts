import { BaseProducer } from './BaseProducer';
import { QUEUES } from '../../config/rabbitmq';
import { validateMessage } from '../../utils/rabbitmq-validation';
import type { EscrowEvent } from '../../types/rabbitmq-schemas';

export class EscrowEventProducer extends BaseProducer<EscrowEvent> {
  protected queue = QUEUES.ACBU_ESCROW_EVENTS;

  protected validate(payload: EscrowEvent): EscrowEvent {
    return validateMessage<EscrowEvent>(this.queue, payload);
  }
}

export const escrowEventProducer = new EscrowEventProducer();