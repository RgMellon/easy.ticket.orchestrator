export type TicketSagaState =
  | 'CREATED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'REASSIGN'
  | 'COMPLETED'
  | 'NO_SURVEY'
  | 'CLOSED';

export type TicketSagaEvent =
  | 'SPECIALIST_ASSIGNED'
  | 'TICKET_ROUTED'
  | 'REPAIR_COMPLETED'
  | 'REASSIGN_REQUESTED'
  | 'SURVEY_SENT'
  | 'SURVEY_FAILED';

export interface TicketSagaContext {
  ticketId: string;
  clientId: string;
  specialistId?: string;
  errorMessage?: string;
}
