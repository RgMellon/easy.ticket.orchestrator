import { Inject, Injectable, Logger } from '@nestjs/common';
import { TicketSagaContext } from '../../domain/ticket-saga.types';
import type { ITicketServiceClient } from '../../domain/ticket.actions';
import { TICKET_SERVICE_CLIENT } from '../../domain/ticket.actions';

@Injectable()
export class RepairCompletedAction {
  private readonly logger = new Logger(RepairCompletedAction.name);

  constructor(
    @Inject(TICKET_SERVICE_CLIENT)
    private readonly ticketServiceClient: ITicketServiceClient,
  ) {}

  async execute(ctx: TicketSagaContext): Promise<void> {
    this.logger.log(`Repair completed for ticket=${ctx.ticketId}`);
    await this.ticketServiceClient.completeTicket(ctx.ticketId);
  }
}
