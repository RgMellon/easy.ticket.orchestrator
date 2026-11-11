import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

  private readonly logger = new Logger(TicketStateMachineUseCase.name);

  async execute(
    ticketId: string,
    event: TicketSagaEvent,
    specialistId?: string,
    reason?: string,
  ): Promise<SendEventResult> {
    this.logger.log({ ticketId, event, specialistId, msg: 'event received' });

    const ticket = await this.ticketRepo.findByTicketId(ticketId);
    this.logger.log({
      ticketId,
      currentState: ticket?.currentState,
      msg: 'ticket fetched',
    });

    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);

    //validar nesse fluxo se eu vou ter o id do especialista no jeito quando eu to na etapa de REPAIR_COMPLETED
    const ctx: TicketSagaContext = {
      ticketId: ticket.id,
      externalTicketId: ticket.ticketId,
      clientId: ticket.clientId,
      specialistId: specialistId ?? ticket.specialistId,
    };

    if (event === 'SPECIALIST_ASSIGNED' && !ctx.specialistId) {
      throw new SpecialistRequiredError();
    }

    const machine = new TicketStateMachine(
      ticket.currentState,
      ctx,
      this.buildActions(),
    );

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

    this.logger.log({ ticketId, event, from, to, msg: 'state updated' });

    if (event === 'REPAIR_COMPLETED') {
      return this.sendSurvey(ticketId, ticket.id, machine, ctx);
    }

    return { ticketId, from, to };
  }

  private buildActions() {
    return {
      onSpecialistAssigned: (c: TicketSagaContext) =>
        this.assignSpecialist.execute(c),
      onTicketRouted: (c: TicketSagaContext) => this.routeTicket.execute(c),
      onRepairCompleted: (c: TicketSagaContext) =>
        this.repairCompleted.execute(c),
      onReassignRequested: (c: TicketSagaContext) =>
        this.reassignRequested.execute(c),
      onSurveySent: (c: TicketSagaContext) => this.surveySent.execute(c),
      onSurveyFailed: (c: TicketSagaContext) => this.surveyFailed.execute(c),
    };
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
      this.logger.log({ ticketId, from, to, msg: 'survey sent' });
      return { ticketId, from, to };
    } catch (error) {
      this.logger.warn({
        ticketId,
        msg: 'survey failed, transitioning to NO_SURVEY',
        error: (error as Error).message,
      });
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
