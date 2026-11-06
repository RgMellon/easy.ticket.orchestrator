import type { TicketSagaContext } from './ticket-saga.types';

export interface ITicketAction {
  execute(ctx: TicketSagaContext): Promise<void>;
}

export interface TicketActions {
  assignSpecialist: ITicketAction;
  routeTicket: ITicketAction;
  repairCompleted: ITicketAction;
  reassignRequested: ITicketAction;
  surveySent: ITicketAction;
  surveyFailed: ITicketAction;
}

export const TICKET_ACTIONS = Symbol('TICKET_ACTIONS');
