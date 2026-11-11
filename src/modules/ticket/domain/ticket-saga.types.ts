export type TicketSagaState =
  | 'CREATED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'REASSIGN'
  | 'COMPLETED'
  | 'NO_SURVEY'
  | 'CLOSED';

export const ticketSagaEvents = [
  'SPECIALIST_ASSIGNED',
  'TICKET_ROUTED',
  'REPAIR_COMPLETED',
  'REASSIGN_REQUESTED',
  'SURVEY_SENT',
  'SURVEY_FAILED',
] as const;

export type TicketSagaEvent = (typeof ticketSagaEvents)[number];

export interface TicketSagaContext {
  ticketId: string;
  externalTicketId: string;
  clientId: string;
  specialistId?: string;
  errorMessage?: string;
}
