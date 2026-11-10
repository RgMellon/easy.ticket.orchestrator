import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import type { IAssignmentEventPublisher } from '../../domain/actions/assignment-event.publisher';

export const TICKET_MANAGEMENT_EXCHANGE = 'ticket.management';

@Injectable()
export class AssignmentEventPublisher implements IAssignmentEventPublisher {
  private readonly logger = new Logger(AssignmentEventPublisher.name);

  constructor(private readonly amqp: AmqpConnection) {}

  async publishAssignmentRequested(ticketId: string): Promise<void> {
    this.logger.log(
      `Publishing ticket.assignment.requested for ticket=${ticketId}`,
    );
    await this.amqp.publish(
      TICKET_MANAGEMENT_EXCHANGE,
      'ticket.assignment.requested',
      { ticketId },
    );
  }
}
