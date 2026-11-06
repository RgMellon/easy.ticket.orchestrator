import { TicketSagaState } from './ticket-saga.types';

export interface TicketEntity {
  id: string;
  clientId: string;
  specialistId?: string;
  currentState: TicketSagaState;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITicketRepository {
  create(data: { clientId: string }): Promise<TicketEntity>;
  findById(id: string): Promise<TicketEntity | null>;
  updateState(
    id: string,
    state: TicketSagaState,
    specialistId?: string,
  ): Promise<void>;
}

export const TICKET_REPOSITORY = Symbol('TICKET_REPOSITORY');
