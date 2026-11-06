import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  ticketSagaEvents,
  type TicketSagaEvent,
} from '../../domain/ticket-saga.types';

export class SendEventDto {
  @IsEnum(ticketSagaEvents)
  event!: TicketSagaEvent;

  @IsOptional()
  @IsString()
  specialistId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateTicketDto {
  @IsString()
  clientId!: string;
}

export interface TicketResponseDto {
  ticketId: string;
  from: string;
  to: string;
}
