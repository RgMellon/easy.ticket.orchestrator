export interface ISurveyServiceClient {
  sendSurvey(ticketId: string, clientId: string): Promise<void>;
}

export const SURVEY_SERVICE_CLIENT = Symbol('SURVEY_SERVICE_CLIENT');
