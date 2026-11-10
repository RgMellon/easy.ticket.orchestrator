export interface ITicketServiceClient {
  createTicket(clientId: string): Promise<{ ticketId: string }>;
  completeTicket(ticketId: string): Promise<void>;
}

export const TICKET_SERVICE_CLIENT = Symbol('TICKET_SERVICE_CLIENT');
