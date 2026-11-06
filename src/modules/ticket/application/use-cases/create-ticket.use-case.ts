import { Inject, Injectable } from '@nestjs/common';
import type { TicketEntity, ITicketRepository } from '../../domain/ticket.repository';
import { TICKET_REPOSITORY } from '../../domain/ticket.repository';

export const CREATE_TICKET_USE_CASE = Symbol('CREATE_TICKET_USE_CASE');

@Injectable()
export class CreateTicketUseCase {
  constructor(
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: ITicketRepository,
  ) {}

  async execute(clientId: string): Promise<TicketEntity> {
    return this.ticketRepo.create({ clientId });
  }
}
