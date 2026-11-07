import { Inject, Injectable } from '@nestjs/common';
import type {
  TicketEntity,
  ITicketRepository,
} from '../../domain/ticket.repository';
import { TICKET_REPOSITORY } from '../../domain/ticket.repository';
import type {
  ITicketServiceClient,
  IAssignmentServiceClient,
} from '../../domain/ticket.actions';
import {
  TICKET_SERVICE_CLIENT,
  ASSIGNMENT_SERVICE_CLIENT,
} from '../../domain/ticket.actions';
import type { TicketStateMachineUseCase } from './ticket-state-machine.use-case';
import { TICKET_STATE_MACHINE_USE_CASE } from './ticket-state-machine.use-case';

export const CREATE_TICKET_USE_CASE = Symbol('CREATE_TICKET_USE_CASE');

@Injectable()
export class CreateTicketUseCase {
  constructor(
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: ITicketRepository,
    @Inject(TICKET_SERVICE_CLIENT)
    private readonly ticketServiceClient: ITicketServiceClient,
    @Inject(ASSIGNMENT_SERVICE_CLIENT)
    private readonly assignmentServiceClient: IAssignmentServiceClient,
    @Inject(TICKET_STATE_MACHINE_USE_CASE)
    private readonly stateMachine: TicketStateMachineUseCase,
  ) {}

  async execute(clientId: string): Promise<TicketEntity> {
    const { ticketId } = await this.ticketServiceClient.createTicket(clientId);
    const ticket = await this.ticketRepo.create({ ticketId, clientId });
    // TODO: substituir por this.assignmentServiceClient.assignSpecialist(ticketId)
    const specialistId = crypto.randomUUID();
    await this.stateMachine.execute(
      ticketId,
      'SPECIALIST_ASSIGNED',
      specialistId,
    );

    return ticket;
  }
}
