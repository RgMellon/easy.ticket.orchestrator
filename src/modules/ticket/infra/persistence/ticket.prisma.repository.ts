import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infra/database/prisma.service';
import type { ITicketRepository, TicketEntity } from '../../application/ports/ticket.repository';
import type { TicketSagaState } from '../../domain/ticket-saga.types';

const toEntity = (raw: any): TicketEntity => ({
  ...raw,
  specialistId: raw.specialistId ?? undefined,
});

@Injectable()
export class TicketPrismaRepository implements ITicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { clientId: string }): Promise<TicketEntity> {
    return toEntity(await this.prisma.ticket.create({ data }));
  }

  async findById(id: string): Promise<TicketEntity | null> {
    const raw = await this.prisma.ticket.findUnique({ where: { id } });
    return raw ? toEntity(raw) : null;
  }

  async updateState(id: string, state: TicketSagaState, specialistId?: string): Promise<void> {
    await this.prisma.ticket.update({
      where: { id },
      data: { currentState: state, ...(specialistId && { specialistId }) },
    });
  }
}
