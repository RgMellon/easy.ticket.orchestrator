import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { TicketSagaState } from '../../domain/ticket-saga.types';

const ticketSagaEvents = [
  'SPECIALIST_ASSIGNED',
  'TICKET_ROUTED',
  'REPAIR_COMPLETED',
  'REASSIGN_REQUESTED',
  'SURVEY_SENT',
  'SURVEY_FAILED',
] as const;

export type TicketSagaEvent = (typeof ticketSagaEvents)[number];

export class SendEventDto {
  @IsEnum(ticketSagaEvents)
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
  from: TicketSagaState;
  to: TicketSagaState;
}
