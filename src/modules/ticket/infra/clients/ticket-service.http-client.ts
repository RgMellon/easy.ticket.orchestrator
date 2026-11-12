import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { ITicketServiceClient } from '../../domain/actions/ticket-service.client';

@Injectable()
export class TicketServiceHttpClient implements ITicketServiceClient {
  private readonly logger = new Logger(TicketServiceHttpClient.name);
  private readonly client = axios.create({
    baseURL: process.env.TICKET_SERVICE_URL ?? 'http://localhost:3001',
  });

  async createTicket(clientId: string): Promise<{ ticketId: string }> {
    this.logger.log(`Creating ticket for clientId=${clientId}`);
    const { data } = await this.client.post<{ id: string }>('/tickets', {
      clientId,
    });
    this.logger.log(`Ticket service response: ${JSON.stringify(data)}`);
    return { ticketId: data.id };
  }

  async completeTicket(ticketId: string): Promise<void> {
    this.logger.log(`Completing ticket=${ticketId}`);
    const { data } = await this.client.patch<unknown>(
      `/tickets/${ticketId}/complete`,
    );
    this.logger.log(`Ticket service response: ${JSON.stringify(data)}`);
  }
}
