import { Inject, Injectable } from '@nestjs/common';
import type {
  TicketEntity,
  ITicketRepository,
} from '../../domain/ticket.repository';
import { TICKET_REPOSITORY } from '../../domain/ticket.repository';
import type { ITicketServiceClient } from '../../domain/actions/ticket-service.client';
import { TICKET_SERVICE_CLIENT } from '../../domain/actions/ticket-service.client';
import type { IAssignmentEventPublisher } from '../../domain/actions/assignment-event.publisher';
import { ASSIGNMENT_EVENT_PUBLISHER } from '../../domain/actions/assignment-event.publisher';

export const CREATE_TICKET_USE_CASE = Symbol('CREATE_TICKET_USE_CASE');

@Injectable()
export class CreateTicketUseCase {
  constructor(
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: ITicketRepository,
    @Inject(TICKET_SERVICE_CLIENT)
    private readonly ticketServiceClient: ITicketServiceClient,
    @Inject(ASSIGNMENT_EVENT_PUBLISHER)
    private readonly assignmentEventPublisher: IAssignmentEventPublisher,
  ) {}

  async execute(clientId: string): Promise<TicketEntity> {
    const { ticketId } = await this.ticketServiceClient.createTicket(clientId);
    const ticket = await this.ticketRepo.create({ ticketId, clientId });
    await this.assignmentEventPublisher.publishAssignmentRequested(ticketId);
    return ticket;
  }
}
