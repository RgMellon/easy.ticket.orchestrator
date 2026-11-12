import type { TicketEntity } from './ticket.repository';

export interface IReconciliationRepository {
  findStuckInCreated(thresholdMinutes: number): Promise<TicketEntity[]>;
  countAttempts(ticketId: string): Promise<number>;
  saveAttempt(
    ticketId: string,
    attemptNumber: number,
    reason: string,
  ): Promise<void>;
}

export const RECONCILIATION_REPOSITORY = Symbol('RECONCILIATION_REPOSITORY');
