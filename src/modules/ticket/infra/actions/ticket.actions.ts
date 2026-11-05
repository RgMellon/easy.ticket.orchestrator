import { Injectable, Logger } from '@nestjs/common';
import { TicketSagaContext } from '../../domain/ticket-saga.types';

@Injectable()
export class AssignSpecialistAction {
  private readonly logger = new Logger(AssignSpecialistAction.name);

  async execute(ctx: TicketSagaContext): Promise<void> {
    this.logger.log(`Assigning specialist to ticket=${ctx.ticketId}`);
  }
}

@Injectable()
export class RouteTicketAction {
  private readonly logger = new Logger(RouteTicketAction.name);

  async execute(ctx: TicketSagaContext): Promise<void> {
    this.logger.log(
      `Routing ticket=${ctx.ticketId} to specialist=${ctx.specialistId}`,
    );
  }
}

@Injectable()
export class RepairCompletedAction {
  private readonly logger = new Logger(RepairCompletedAction.name);

  async execute(ctx: TicketSagaContext): Promise<void> {
    this.logger.log(`Repair completed for ticket=${ctx.ticketId}`);
  }
}

@Injectable()
export class ReassignRequestedAction {
  private readonly logger = new Logger(ReassignRequestedAction.name);

  async execute(ctx: TicketSagaContext): Promise<void> {
    this.logger.log(
      `Reassign requested for ticket=${ctx.ticketId} reason=${ctx.errorMessage}`,
    );
  }
}

@Injectable()
export class SurveySentAction {
  private readonly logger = new Logger(SurveySentAction.name);

  async execute(ctx: TicketSagaContext): Promise<void> {
    return this.logger.log(
      `Survey sent for ticket=${ctx.ticketId} client=${ctx.clientId}`,
    );
  }
}

@Injectable()
export class SurveyFailedAction {
  private readonly logger = new Logger(SurveyFailedAction.name);

  async execute(ctx: TicketSagaContext): Promise<void> {
    this.logger.log(
      `Survey failed for ticket=${ctx.ticketId}, queued for retry`,
    );
  }
}
