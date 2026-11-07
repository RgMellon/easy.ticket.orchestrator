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

export interface ITicketServiceClient {
  createTicket(clientId: string): Promise<{ ticketId: string }>;
  completeTicket(ticketId: string): Promise<void>;
}

export const TICKET_SERVICE_CLIENT = Symbol('TICKET_SERVICE_CLIENT');

export interface ISurveyServiceClient {
  sendSurvey(ticketId: string, clientId: string): Promise<void>;
}

export const SURVEY_SERVICE_CLIENT = Symbol('SURVEY_SERVICE_CLIENT');

export interface IAssignmentServiceClient {
  assignSpecialist(ticketId: string): Promise<{ specialistId: string }>;
}

export const ASSIGNMENT_SERVICE_CLIENT = Symbol('ASSIGNMENT_SERVICE_CLIENT');
