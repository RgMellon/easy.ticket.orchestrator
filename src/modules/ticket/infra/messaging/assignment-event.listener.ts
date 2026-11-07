import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { Inject } from '@nestjs/common';
import type { TicketStateMachineUseCase } from '../../application/use-cases/ticket-state-machine.use-case';
import { TICKET_STATE_MACHINE_USE_CASE } from '../../application/use-cases/ticket-state-machine.use-case';
import { TICKET_MANAGEMENT_EXCHANGE } from './assignment-event.publisher';

interface AssignmentCompletedPayload {
  ticketId: string;
  specialistId: string;
}

@Injectable()
export class AssignmentEventListener {
  private readonly logger = new Logger(AssignmentEventListener.name);

  constructor(
    @Inject(TICKET_STATE_MACHINE_USE_CASE)
    private readonly stateMachine: TicketStateMachineUseCase,
  ) {}

  @RabbitSubscribe({
    exchange: TICKET_MANAGEMENT_EXCHANGE,
    routingKey: 'ticket.assignment.completed',
    queue: 'orchestrator.ticket.management',
    queueOptions: { durable: true },
  })
  async handleAssignmentCompleted(payload: AssignmentCompletedPayload): Promise<void> {
    this.logger.log(`Received ticket.assignment.completed for ticket=${payload.ticketId}`);
    await this.stateMachine.execute(payload.ticketId, 'SPECIALIST_ASSIGNED', payload.specialistId);
  }
}
