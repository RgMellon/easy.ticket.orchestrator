import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infra/database/prisma.service';
import type { IReconciliationRepository } from '../../domain/reconciliation.repository';
import type { TicketEntity } from '../../domain/ticket.repository';

@Injectable()
export class ReconciliationPrismaRepository implements IReconciliationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findStuckInCreated(thresholdMinutes: number): Promise<TicketEntity[]> {
    const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);
    const rows = await this.prisma.ticket.findMany({
      where: { currentState: 'CREATED', updatedAt: { lt: threshold } },
    });
    return rows.map((r) => ({
      ...r,
      specialistId: r.specialistId ?? undefined,
      currentState: r.currentState,
    }));
  }

  countAttempts(ticketId: string): Promise<number> {
    return this.prisma.ticketReconciliationLog.count({ where: { ticketId } });
  }

  async saveAttempt(
    ticketId: string,
    attemptNumber: number,
    reason: string,
  ): Promise<void> {
    await this.prisma.ticketReconciliationLog.create({
      data: { ticketId, attemptNumber, reason },
    });
  }
}
