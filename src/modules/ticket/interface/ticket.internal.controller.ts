import { Controller, Inject, Param, Post, Body } from '@nestjs/common';
import type { IAssignmentEventPublisher } from '../domain/actions/assignment-event.publisher';
import { ASSIGNMENT_EVENT_PUBLISHER } from '../domain/actions/assignment-event.publisher';

@Controller('internal/tickets')
export class TicketInternalController {
  constructor(
    @Inject(ASSIGNMENT_EVENT_PUBLISHER)
    private readonly publisher: IAssignmentEventPublisher,
  ) {}

  @Post(':ticketId/simulate/assignment-requested')
  async simulateAssignmentRequested(
    @Param('ticketId') ticketId: string,
  ): Promise<{ published: boolean }> {
    await this.publisher.publishAssignmentRequested(ticketId);
    return { published: true };
  }
}
