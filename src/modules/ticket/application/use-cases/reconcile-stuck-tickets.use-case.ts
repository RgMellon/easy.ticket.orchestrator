import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IReconciliationRepository } from '../../domain/reconciliation.repository';
import { RECONCILIATION_REPOSITORY } from '../../domain/reconciliation.repository';
import type { IAssignmentEventPublisher } from '../../domain/actions/assignment-event.publisher';
import { ASSIGNMENT_EVENT_PUBLISHER } from '../../domain/actions/assignment-event.publisher';

export const RECONCILE_STUCK_TICKETS_USE_CASE = Symbol(
  'RECONCILE_STUCK_TICKETS_USE_CASE',
);

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES ?? '5', 10);
const THRESHOLD_MINUTES = parseInt(
  process.env.STUCK_TICKET_THRESHOLD_MINUTES ?? '10',
  10,
);

@Injectable()
export class ReconcileStuckTicketsUseCase {
  private readonly logger = new Logger(ReconcileStuckTicketsUseCase.name);

  constructor(
    @Inject(RECONCILIATION_REPOSITORY)
    private readonly reconciliationRepo: IReconciliationRepository,
    @Inject(ASSIGNMENT_EVENT_PUBLISHER)
    private readonly publisher: IAssignmentEventPublisher,
  ) {}

  async execute(): Promise<void> {
    const stuck =
      await this.reconciliationRepo.findStuckInCreated(THRESHOLD_MINUTES);

    if (!stuck.length) {
      this.logger.log('No stuck tickets found');
      return;
    }

    this.logger.log(`Found ${stuck.length} stuck ticket(s) in CREATED`);

    for (const ticket of stuck) {
      const attempts = await this.reconciliationRepo.countAttempts(ticket.id);

      if (attempts >= MAX_RETRIES) {
        this.logger.warn({
          ticketId: ticket.ticketId,
          attempts,
          msg: 'Ticket stuck in CREATED exceeded MAX_RETRIES — manual intervention required',
        });
        continue;
      }

      await this.publisher.publishAssignmentRequested(ticket.ticketId);
      await this.reconciliationRepo.saveAttempt(
        ticket.id,
        attempts + 1,
        'stuck_in_created',
      );

      this.logger.log({
        ticketId: ticket.ticketId,
        attempt: attempts + 1,
        msg: 'Republished assignment.requested for stuck ticket',
      });
    }
  }
}
