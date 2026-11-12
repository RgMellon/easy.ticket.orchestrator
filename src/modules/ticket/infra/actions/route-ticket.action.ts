import { Injectable, Logger } from '@nestjs/common';
import { TicketSagaContext } from '../../domain/ticket-saga.types';

@Injectable()
export class RouteTicketAction {
  private readonly logger = new Logger(RouteTicketAction.name);

  execute(ctx: TicketSagaContext): Promise<void> {
    this.logger.log(
      `Routing ticket=${ctx.ticketId} to specialist=${ctx.specialistId}`,
    );
    return Promise.resolve();
  }
}
