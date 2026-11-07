import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { IAssignmentServiceClient } from '../../domain/ticket.actions';

@Injectable()
export class AssignmentServiceHttpClient implements IAssignmentServiceClient {
  private readonly logger = new Logger(AssignmentServiceHttpClient.name);
  private readonly client = axios.create({
    baseURL: process.env.ASSIGNMENT_SERVICE_URL ?? 'http://localhost:3003',
  });

  async assignSpecialist(ticketId: string): Promise<{ specialistId: string }> {
    this.logger.log(`Assigning specialist for ticket=${ticketId}`);
    const { data } = await this.client.post<{ specialistId: string }>('/assignments', { ticketId });
    return { specialistId: data.specialistId };
  }
}
