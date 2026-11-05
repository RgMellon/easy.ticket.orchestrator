import { Body, Controller, Inject, Param, Post } from '@nestjs/common';
import { TicketStateMachineUseCase, TICKET_STATE_MACHINE_USE_CASE } from '../application/use-cases/ticket-state-machine.use-case';
import { CreateTicketDto, SendEventDto, TicketResponseDto } from './dto/ticket.dto';
import { TICKET_REPOSITORY } from '../application/ports/ticket.repository';
import type { ITicketRepository } from '../application/ports/ticket.repository';

@Controller('tickets')
export class TicketController {
  constructor(
    @Inject(TICKET_STATE_MACHINE_USE_CASE)
    private readonly stateMachine: TicketStateMachineUseCase,
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: ITicketRepository,
  ) {}

  @Post()
  async create(@Body() dto: CreateTicketDto) {
    return this.ticketRepo.create({ clientId: dto.clientId });
  }

  @Post(':id/events')
  async sendEvent(
    @Param('id') id: string,
    @Body() dto: SendEventDto,
  ): Promise<TicketResponseDto> {
    return this.stateMachine.execute(id, dto.event, dto.reason);
  }
}
