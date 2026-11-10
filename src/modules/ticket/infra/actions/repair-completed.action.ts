import { Inject, Injectable, Logger } from '@nestjs/common';
import { TicketSagaContext } from '../../domain/ticket-saga.types';
import type { ITicketServiceClient } from '../../domain/actions/ticket-service.client';
import { TICKET_SERVICE_CLIENT } from '../../domain/actions/ticket-service.client';

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

// Continuar do RepairCompleted da action, ver o que ta fazendo
// Validart tbm o service de assignment
