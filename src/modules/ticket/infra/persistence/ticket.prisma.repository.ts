import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infra/database/prisma.service';
import type { ITicketRepository, TicketEntity } from '../../domain/ticket.repository';
import type { TicketSagaState } from '../../domain/ticket-saga.types';

const toEntity = (raw: { id: string; ticketId: string; clientId: string; specialistId: string | null; currentState: TicketSagaState; createdAt: Date; updatedAt: Date }): TicketEntity => ({
  ...raw,
  specialistId: raw.specialistId ?? undefined,
});

@Injectable()
export class TicketPrismaRepository implements ITicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { ticketId: string; clientId: string }): Promise<TicketEntity> {
    return toEntity(
      await this.prisma.ticket.create({ data: { ticketId: data.ticketId, clientId: data.clientId } }),
    );
  }

  async findByTicketId(ticketId: string): Promise<TicketEntity | null> {
    const raw = await this.prisma.ticket.findUnique({ where: { ticketId } });
    return raw ? toEntity(raw) : null;
  }

  async updateState(ticketId: string, state: TicketSagaState, specialistId?: string): Promise<void> {
    await this.prisma.ticket.update({
      where: { ticketId },
      data: { currentState: state, ...(specialistId && { specialistId }) },
    });
  }
}
