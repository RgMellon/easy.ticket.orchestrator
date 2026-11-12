import { Injectable, Logger } from '@nestjs/common';
import { TicketSagaContext } from '../../domain/ticket-saga.types';

@Injectable()
export class AssignSpecialistAction {
  private readonly logger = new Logger(AssignSpecialistAction.name);

  execute(ctx: TicketSagaContext): Promise<void> {
    this.logger.log(`Assigning specialist to ticket=${ctx.ticketId}`);
    return Promise.resolve();
  }
}
