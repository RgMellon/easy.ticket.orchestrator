import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type { ISurveyServiceClient } from '../../domain/ticket.actions';

@Injectable()
export class SurveyServiceHttpClient implements ISurveyServiceClient {
  private readonly logger = new Logger(SurveyServiceHttpClient.name);
  private readonly client = axios.create({
    baseURL: process.env.SURVEY_SERVICE_URL ?? 'http://localhost:3002',
  });

  async sendSurvey(ticketId: string, clientId: string): Promise<void> {
    this.logger.log(`Sending survey for ticket=${ticketId} client=${clientId}`);
    await this.client.post('/surveys', { ticketId, clientId });
  }
}
