import { CreateTicketUseCase } from '../create-ticket.use-case';
import type { TicketEntity } from '../../../domain/ticket.repository';

const makeTicket = (): TicketEntity => ({
  id: 'saga-1',
  ticketId: 'ticket-1',
  clientId: 'client-1',
  currentState: 'CREATED',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeUseCase = () => {
  const ticketRepo = {
    create: jest.fn().mockResolvedValue(makeTicket()),
    findByTicketId: jest.fn(),
    updateState: jest.fn(),
  };
  const ticketServiceClient = {
    createTicket: jest.fn().mockResolvedValue({ ticketId: 'ticket-1' }),
    completeTicket: jest.fn(),
  };
  const assignmentEventPublisher = {
    publishAssignmentRequested: jest.fn().mockResolvedValue(undefined),
  };

  const useCase = new CreateTicketUseCase(
    ticketRepo,
    ticketServiceClient,
    assignmentEventPublisher,
  );

  return { useCase, ticketRepo, ticketServiceClient, assignmentEventPublisher };
};

describe('CreateTicketUseCase', () => {
  it('creates ticket and publishes assignment requested event', async () => {
    const {
      useCase,
      ticketRepo,
      ticketServiceClient,
      assignmentEventPublisher,
    } = makeUseCase();

    const result = await useCase.execute('client-1');

    expect(ticketServiceClient.createTicket).toHaveBeenCalledWith('client-1');
    expect(ticketRepo.create).toHaveBeenCalledWith({
      ticketId: 'ticket-1',
      clientId: 'client-1',
    });
    expect(
      assignmentEventPublisher.publishAssignmentRequested,
    ).toHaveBeenCalledWith('ticket-1');
    expect(result.currentState).toBe('CREATED');
  });

  it('returns ticket in CREATED state without waiting for assignment', async () => {
    const { useCase } = makeUseCase();
    const result = await useCase.execute('client-1');
    expect(result.currentState).toBe('CREATED');
  });

  it('does not publish event if ticket creation in repo fails', async () => {
    const { useCase, ticketRepo, assignmentEventPublisher } = makeUseCase();
    ticketRepo.create.mockRejectedValue(new Error('db error'));

    await expect(useCase.execute('client-1')).rejects.toThrow('db error');
    expect(
      assignmentEventPublisher.publishAssignmentRequested,
    ).not.toHaveBeenCalled();
  });

  it('does not persist ticket if ticket service fails', async () => {
    const { useCase, ticketServiceClient, ticketRepo } = makeUseCase();
    ticketServiceClient.createTicket.mockRejectedValue(
      new Error('service unavailable'),
    );

    await expect(useCase.execute('client-1')).rejects.toThrow(
      'service unavailable',
    );
    expect(ticketRepo.create).not.toHaveBeenCalled();
  });
});
