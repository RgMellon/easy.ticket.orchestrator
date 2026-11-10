import type { TicketSagaContext } from '../ticket-saga.types';

export interface ITicketAction {
  execute(ctx: TicketSagaContext): Promise<void>;
}
