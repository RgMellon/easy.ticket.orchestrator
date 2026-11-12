import { ReconcileStuckTicketsUseCase } from '../reconcile-stuck-tickets.use-case';
import type { TicketEntity } from '../../../domain/ticket.repository';

const makeTicket = (override?: Partial<TicketEntity>): TicketEntity => ({
  id: 'internal-1',
  ticketId: 'ticket-1',
  clientId: 'client-1',
  currentState: 'CREATED',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...override,
});

const makeUseCase = () => {
  const reconciliationRepo = {
    findStuckInCreated: jest.fn().mockResolvedValue([]),
    countAttempts: jest.fn().mockResolvedValue(0),
    saveAttempt: jest.fn().mockResolvedValue(undefined),
  };
  const publisher = {
    publishAssignmentRequested: jest.fn().mockResolvedValue(undefined),
  };
  const useCase = new ReconcileStuckTicketsUseCase(
    reconciliationRepo,
    publisher,
  );
  return { useCase, reconciliationRepo, publisher };
};

describe('ReconcileStuckTicketsUseCase', () => {
  it('does nothing when no stuck tickets found', async () => {
    const { useCase, publisher } = makeUseCase();

    await useCase.execute();

    expect(publisher.publishAssignmentRequested).not.toHaveBeenCalled();
  });

  it('republishes assignment.requested for stuck ticket with attempts < MAX_RETRIES', async () => {
    const { useCase, reconciliationRepo, publisher } = makeUseCase();
    reconciliationRepo.findStuckInCreated.mockResolvedValue([makeTicket()]);
    reconciliationRepo.countAttempts.mockResolvedValue(2);

    await useCase.execute();

    expect(publisher.publishAssignmentRequested).toHaveBeenCalledWith(
      'ticket-1',
    );
  });

  it('saves attempt after republishing', async () => {
    const { useCase, reconciliationRepo } = makeUseCase();
    reconciliationRepo.findStuckInCreated.mockResolvedValue([makeTicket()]);
    reconciliationRepo.countAttempts.mockResolvedValue(2);

    await useCase.execute();

    expect(reconciliationRepo.saveAttempt).toHaveBeenCalledWith(
      'internal-1',
      3,
      'stuck_in_created',
    );
  });

  it('does not republish when attempts >= MAX_RETRIES', async () => {
    const { useCase, reconciliationRepo, publisher } = makeUseCase();
    reconciliationRepo.findStuckInCreated.mockResolvedValue([makeTicket()]);
    reconciliationRepo.countAttempts.mockResolvedValue(5);

    await useCase.execute();

    expect(publisher.publishAssignmentRequested).not.toHaveBeenCalled();
    expect(reconciliationRepo.saveAttempt).not.toHaveBeenCalled();
  });

  it('processes each stuck ticket independently', async () => {
    const { useCase, reconciliationRepo, publisher } = makeUseCase();
    reconciliationRepo.findStuckInCreated.mockResolvedValue([
      makeTicket({ id: 'internal-1', ticketId: 'ticket-1' }),
      makeTicket({ id: 'internal-2', ticketId: 'ticket-2' }),
    ]);
    reconciliationRepo.countAttempts
      .mockResolvedValueOnce(1) // ticket-1: abaixo do limite
      .mockResolvedValueOnce(5); // ticket-2: atingiu MAX_RETRIES

    await useCase.execute();

    expect(publisher.publishAssignmentRequested).toHaveBeenCalledTimes(1);
    expect(publisher.publishAssignmentRequested).toHaveBeenCalledWith(
      'ticket-1',
    );
  });
});
