import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { ReconcileStuckTicketsUseCase } from './reconcile-stuck-tickets.use-case';
import { RECONCILE_STUCK_TICKETS_USE_CASE } from './reconcile-stuck-tickets.use-case';

@Injectable()
export class ReconcileStuckTicketsCron {
  private readonly logger = new Logger(ReconcileStuckTicketsCron.name);

  constructor(
    @Inject(RECONCILE_STUCK_TICKETS_USE_CASE)
    private readonly useCase: ReconcileStuckTicketsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run(): Promise<void> {
    this.logger.log('Running reconciliation job...');
    await this.useCase.execute();
  }
}
