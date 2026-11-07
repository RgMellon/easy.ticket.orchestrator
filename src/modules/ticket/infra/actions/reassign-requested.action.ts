import { Injectable, Logger } from '@nestjs/common';
import { TicketSagaContext } from '../../domain/ticket-saga.types';

@Injectable()
export class ReassignRequestedAction {
  private readonly logger = new Logger(ReassignRequestedAction.name);

  async execute(ctx: TicketSagaContext): Promise<void> {
    this.logger.log(
      `Reassign requested for ticket=${ctx.ticketId} reason=${ctx.errorMessage}`,
    );
  }
}
