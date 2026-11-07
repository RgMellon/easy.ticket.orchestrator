import type { TicketSagaContext } from './ticket-saga.types';

export interface ITicketAction {
  execute(ctx: TicketSagaContext): Promise<void>;
}

export interface ITicketServiceClient {
  createTicket(clientId: string): Promise<{ ticketId: string }>;
  completeTicket(ticketId: string): Promise<void>;
}

export const TICKET_SERVICE_CLIENT = Symbol('TICKET_SERVICE_CLIENT');

export interface ISurveyServiceClient {
  sendSurvey(ticketId: string, clientId: string): Promise<void>;
}

export const SURVEY_SERVICE_CLIENT = Symbol('SURVEY_SERVICE_CLIENT');

export interface IAssignmentEventPublisher {
  publishAssignmentRequested(ticketId: string): Promise<void>;
}

export const ASSIGNMENT_EVENT_PUBLISHER = Symbol('ASSIGNMENT_EVENT_PUBLISHER');

//TODO nao deveria ficar separado aqui?
