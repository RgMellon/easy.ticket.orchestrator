import { Injectable, Logger } from '@nestjs/common';
import { TicketSagaContext } from '../../domain/ticket-saga.types';

@Injectable()
export class SurveySentAction {
  private readonly logger = new Logger(SurveySentAction.name);

  execute(ctx: TicketSagaContext): Promise<void> {
    this.logger.log(
      `Survey queued for ticket=${ctx.ticketId} client=${ctx.clientId}`,
    );
    // TODO: publicar na fila para o MS de pesquisa consumir
    return Promise.resolve();
  }
}
