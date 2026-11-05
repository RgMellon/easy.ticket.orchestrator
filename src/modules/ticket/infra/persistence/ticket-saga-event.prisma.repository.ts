import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infra/database/prisma.service';
import type { ITicketSagaEventRepository, TicketSagaEventEntity } from '../../application/ports/ticket-saga-event.repository';

@Injectable()
export class TicketSagaEventPrismaRepository implements ITicketSagaEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(event: TicketSagaEventEntity): Promise<void> {
    await this.prisma.ticketSagaEventLog.create({ data: event });
  }
}
