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
import { AssignSpecialistAction } from '../../infra/actions/assign-specialist.action';
import { RouteTicketAction } from '../../infra/actions/route-ticket.action';
import { RepairCompletedAction } from '../../infra/actions/repair-completed.action';
import { ReassignRequestedAction } from '../../infra/actions/reassign-requested.action';
import { SurveySentAction } from '../../infra/actions/survey-sent.action';
import { SurveyFailedAction } from '../../infra/actions/survey-failed.action';

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
    specialistId?: string,
    reason?: string,
  ): Promise<SendEventResult> {
    const ticket = await this.ticketRepo.findByTicketId(ticketId);

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
      ticketId: ticket.id,
      fromState: from,
      toState: to,
      triggeredBy: event,
      errorMessage: ctx.errorMessage,
    });

    if (event === 'REPAIR_COMPLETED') {
      return this.sendSurvey(ticketId, ticket.id, machine, ctx);
    }

    return { ticketId, from, to };
  }

  private async sendSurvey(
    ticketId: string,
    internalId: string,
    machine: TicketStateMachine,
    ctx: TicketSagaContext,
  ): Promise<SendEventResult> {
    const from = machine.getCurrentState();
    try {
      const to = await machine.send('SURVEY_SENT');
      await this.ticketRepo.updateState(ticketId, to);
      await this.eventRepo.save({
        ticketId: internalId,
        fromState: from,
        toState: to,
        triggeredBy: 'SURVEY_SENT',
      });
      return { ticketId, from, to };
    } catch {
      const to = await machine.send('SURVEY_FAILED');
      await this.ticketRepo.updateState(ticketId, to);
      await this.eventRepo.save({
        ticketId: internalId,
        fromState: from,
        toState: to,
        triggeredBy: 'SURVEY_FAILED',
      });
      return { ticketId, from, to };
    }
  }
}
