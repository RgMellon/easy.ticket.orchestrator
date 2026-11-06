import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SpecialistRequiredError } from '../../../../common/errors/domain.errors';
import { TicketStateMachine } from '../../domain/ticket-state-machine';
import type {
  TicketSagaContext,
  TicketSagaEvent,
  TicketSagaState,
} from '../../domain/ticket-saga.types';
import type { ITicketRepository } from '../../domain/ticket.repository';
import { TICKET_REPOSITORY } from '../../domain/ticket.repository';
import type { ITicketSagaEventRepository } from '../../domain/ticket-saga-event.repository';
import { TICKET_SAGA_EVENT_REPOSITORY } from '../../domain/ticket-saga-event.repository';
import type { TicketActions } from '../../domain/ticket.actions';
import { TICKET_ACTIONS } from '../../domain/ticket.actions';

export interface SendEventResult {
  ticketId: string;
  from: TicketSagaState;
  to: TicketSagaState;
}

export const TICKET_STATE_MACHINE_USE_CASE = Symbol(
  'TICKET_STATE_MACHINE_USE_CASE',
);

@Injectable()
export class TicketStateMachineUseCase {
  constructor(
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: ITicketRepository,
    @Inject(TICKET_SAGA_EVENT_REPOSITORY)
    private readonly eventRepo: ITicketSagaEventRepository,
    @Inject(TICKET_ACTIONS)
    private readonly actions: TicketActions,
  ) {}

  async execute(
    ticketId: string,
    event: TicketSagaEvent,
    specialistId?: string,
    reason?: string,
  ): Promise<SendEventResult> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);

    const ctx: TicketSagaContext = {
      ticketId: ticket.id,
      clientId: ticket.clientId,
      specialistId: specialistId ?? ticket.specialistId,
    };

    if (event === 'SPECIALIST_ASSIGNED' && !ctx.specialistId) {
      throw new SpecialistRequiredError();
    }

    const machine = new TicketStateMachine(ticket.currentState, ctx, {
      onSpecialistAssigned: (c) => this.actions.assignSpecialist.execute(c),
      onTicketRouted: (c) => this.actions.routeTicket.execute(c),
      onRepairCompleted: (c) => this.actions.repairCompleted.execute(c),
      onReassignRequested: (c) => this.actions.reassignRequested.execute(c),
      onSurveySent: (c) => this.actions.surveySent.execute(c),
      onSurveyFailed: (c) => this.actions.surveyFailed.execute(c),
    });

    const from = machine.getCurrentState();
    const to = await machine.send(event, reason);

    await this.ticketRepo.updateState(ticketId, to, ctx.specialistId);
    await this.eventRepo.save({
      ticketId,
      fromState: from,
      toState: to,
      triggeredBy: event,
      errorMessage: ctx.errorMessage,
    });

    return { ticketId, from, to };
  }
}
