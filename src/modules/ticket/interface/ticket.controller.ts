import { Body, Controller, Inject, Param, Post } from '@nestjs/common';
import {
  TicketStateMachineUseCase,
  TICKET_STATE_MACHINE_USE_CASE,
} from '../application/use-cases/ticket-state-machine.use-case';
import {
  CreateTicketUseCase,
  CREATE_TICKET_USE_CASE,
} from '../application/use-cases/create-ticket.use-case';
import {
  CreateTicketDto,
  SendEventDto,
  TicketResponseDto,
} from './dto/ticket.dto';

@Controller('tickets')
export class TicketController {
  constructor(
    @Inject(CREATE_TICKET_USE_CASE)
    private readonly createTicket: CreateTicketUseCase,
    @Inject(TICKET_STATE_MACHINE_USE_CASE)
    private readonly stateMachine: TicketStateMachineUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateTicketDto) {
    return this.createTicket.execute(dto.clientId);
  }

  @Post(':id/events')
  async sendEvent(
    @Param('id') id: string,
    @Body() dto: SendEventDto,
  ): Promise<TicketResponseDto> {
    return this.stateMachine.execute(id, dto.event, dto.reason);
  }
}
