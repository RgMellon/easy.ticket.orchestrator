import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { TicketSagaEvent } from '../../domain/ticket-saga.types';

export class SendEventDto {
  @IsEnum(['SPECIALIST_ASSIGNED', 'TICKET_ROUTED', 'REPAIR_COMPLETED', 'REASSIGN_REQUESTED', 'SURVEY_SENT', 'SURVEY_FAILED'])
  event: TicketSagaEvent;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateTicketDto {
  @IsString()
  clientId: string;
}

export interface TicketResponseDto {
  ticketId: string;
  from: string;
  to: string;
}
