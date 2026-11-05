import { TicketSagaEvent, TicketSagaState } from '../../domain/ticket-saga.types';

export interface TicketSagaEventEntity {
  ticketId: string;
  fromState: TicketSagaState;
  toState: TicketSagaState;
  triggeredBy: TicketSagaEvent;
  errorMessage?: string;
}

export interface ITicketSagaEventRepository {
  save(event: TicketSagaEventEntity): Promise<void>;
}

export const TICKET_SAGA_EVENT_REPOSITORY = Symbol(
  'TICKET_SAGA_EVENT_REPOSITORY',
);
