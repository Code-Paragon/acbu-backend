import { BaseProducer } from './BaseProducer';
import { QUEUES } from '../../config/rabbitmq';
import { validateMessage } from '../../utils/rabbitmq-validation';
import type { AuditLog } from '../../types/rabbitmq-schemas';

export class AuditLogProducer extends BaseProducer<AuditLog> {
  protected queue = QUEUES.AUDIT_LOGS;

  protected validate(payload: AuditLog): AuditLog {
    return validateMessage<AuditLog>(this.queue, payload);
  }
}

export const auditLogProducer = new AuditLogProducer();