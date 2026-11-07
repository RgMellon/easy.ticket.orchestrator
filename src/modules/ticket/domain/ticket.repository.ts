import { TicketSagaState } from './ticket-saga.types';

export interface TicketEntity {
  id: string;
  ticketId: string;
  clientId: string;
  specialistId?: string;
  currentState: TicketSagaState;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITicketRepository {
  create(data: { ticketId: string; clientId: string }): Promise<TicketEntity>;
  findByTicketId(ticketId: string): Promise<TicketEntity | null>;
  updateState(
    ticketId: string,
    state: TicketSagaState,
    specialistId?: string,
  ): Promise<void>;
}

export const TICKET_REPOSITORY = Symbol('TICKET_REPOSITORY');
