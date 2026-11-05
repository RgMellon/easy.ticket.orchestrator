import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TicketStateMachine } from '../../domain/ticket-state-machine';
import {
  TicketSagaContext,
  TicketSagaEvent,
  TicketSagaState,
} from '../../domain/ticket-saga.types';
import type { ITicketRepository } from '../ports/ticket.repository';
import { TICKET_REPOSITORY } from '../ports/ticket.repository';
import type { ITicketSagaEventRepository } from '../ports/ticket-saga-event.repository';
import { TICKET_SAGA_EVENT_REPOSITORY } from '../ports/ticket-saga-event.repository';
import {
  AssignSpecialistAction,
  RouteTicketAction,
  RepairCompletedAction,
  ReassignRequestedAction,
  SurveySentAction,
  SurveyFailedAction,
} from '../../infra/actions/ticket.actions';

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
    private readonly assignSpecialist: AssignSpecialistAction,
    private readonly routeTicket: RouteTicketAction,
    private readonly repairCompleted: RepairCompletedAction,
    private readonly reassignRequested: ReassignRequestedAction,
    private readonly surveySent: SurveySentAction,
    private readonly surveyFailed: SurveyFailedAction,
  ) {}

  async execute(
    ticketId: string,
    event: TicketSagaEvent,
    reason?: string,
  ): Promise<SendEventResult> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);

    const ctx: TicketSagaContext = {
      ticketId: ticket.id,
      clientId: ticket.clientId,
      specialistId: ticket.specialistId,
    };

    const machine = new TicketStateMachine(ticket.currentState, ctx, {
      onSpecialistAssigned: (c) => this.assignSpecialist.execute(c),
      onTicketRouted: (c) => this.routeTicket.execute(c),
      onRepairCompleted: (c) => this.repairCompleted.execute(c),
      onReassignRequested: (c) => this.reassignRequested.execute(c),
      onSurveySent: (c) => this.surveySent.execute(c),
      onSurveyFailed: (c) => this.surveyFailed.execute(c),
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
