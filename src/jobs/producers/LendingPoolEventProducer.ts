import { BaseProducer } from './BaseProducer';
import { QUEUES } from '../../config/rabbitmq';
import { validateMessage } from '../../utils/rabbitmq-validation';
import type { LendingPoolEvent } from '../../types/rabbitmq-schemas';

export class LendingPoolEventProducer extends BaseProducer<LendingPoolEvent> {
  protected queue = QUEUES.ACBU_LENDING_POOL_EVENTS;

  protected validate(payload: LendingPoolEvent): LendingPoolEvent {
    return validateMessage<LendingPoolEvent>(this.queue, payload);
  }
}

export const lendingPoolEventProducer = new LendingPoolEventProducer();