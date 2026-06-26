import { BaseProducer } from './BaseProducer';
import { QUEUES } from '../../config/rabbitmq';
import { validateMessage } from '../../utils/rabbitmq-validation';
import type { SavingsVaultEvent } from '../../types/rabbitmq-schemas';

export class SavingsVaultEventProducer extends BaseProducer<SavingsVaultEvent> {
  protected queue = QUEUES.ACBU_SAVINGS_VAULT_EVENTS;

  protected validate(payload: SavingsVaultEvent): SavingsVaultEvent {
    return validateMessage<SavingsVaultEvent>(this.queue, payload);
  }
}

export const savingsVaultEventProducer = new SavingsVaultEventProducer();