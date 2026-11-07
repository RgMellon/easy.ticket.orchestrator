import { Injectable, Logger } from '@nestjs/common';
import { TicketSagaContext } from '../../domain/ticket-saga.types';

@Injectable()
export class SurveyFailedAction {
  private readonly logger = new Logger(SurveyFailedAction.name);

  async execute(ctx: TicketSagaContext): Promise<void> {
    this.logger.log(
      `Survey failed for ticket=${ctx.ticketId}, queued for retry`,
    );
  }
}
