import { NotFoundException } from '@nestjs/common';
import { TicketStateMachineUseCase } from '../ticket-state-machine.use-case';
import { TicketEntity } from '../../../domain/ticket.repository';
import { SpecialistRequiredError } from '../../../../../common/errors/domain.errors';

const makeTicket = (override?: Partial<TicketEntity>): TicketEntity => ({
  id: 'saga-1',
  ticketId: 'ticket-1',
  clientId: 'client-1',
  specialistId: undefined,
  currentState: 'CREATED',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...override,
});

const makeUseCase = (ticket: TicketEntity | null = makeTicket()) => {
  const ticketRepo = {
    findByTicketId: jest.fn().mockResolvedValue(ticket),
    updateState: jest.fn().mockResolvedValue(undefined),
    create: jest.fn(),
  };
  const eventRepo = { save: jest.fn().mockResolvedValue(undefined) };
  const assignSpecialist = { execute: jest.fn().mockResolvedValue(undefined) };
  const routeTicket = { execute: jest.fn().mockResolvedValue(undefined) };
  const repairCompleted = { execute: jest.fn().mockResolvedValue(undefined) };
  const reassignRequested = { execute: jest.fn().mockResolvedValue(undefined) };
  const surveySent = { execute: jest.fn().mockResolvedValue(undefined) };
  const surveyFailed = { execute: jest.fn().mockResolvedValue(undefined) };

  const useCase = new TicketStateMachineUseCase(
    ticketRepo,
    eventRepo,
    assignSpecialist as any,
    routeTicket as any,
    repairCompleted as any,
    reassignRequested as any,
    surveySent as any,
    surveyFailed as any,
  );

  return {
    useCase,
    ticketRepo,
    eventRepo,
    assignSpecialist,
    routeTicket,
    repairCompleted,
    reassignRequested,
    surveySent,
    surveyFailed,
  };
};

describe('TicketStateMachineUseCase', () => {
  it('throws NotFoundException when ticket does not exist', async () => {
    const { useCase } = makeUseCase(null);
    await expect(
      useCase.execute('ticket-1', 'SPECIALIST_ASSIGNED'),
    ).rejects.toThrow(NotFoundException);
  });

  it('transitions CREATED → ASSIGNED and persists specialistId', async () => {
    const { useCase, ticketRepo, eventRepo, assignSpecialist } = makeUseCase();

    const result = await useCase.execute(
      'ticket-1',
      'SPECIALIST_ASSIGNED',
      'specialist-99',
    );

    expect(result).toEqual({
      ticketId: 'ticket-1',
      from: 'CREATED',
      to: 'ASSIGNED',
    });
    expect(assignSpecialist.execute).toHaveBeenCalledTimes(1);
    expect(ticketRepo.updateState).toHaveBeenCalledWith(
      'ticket-1',
      'ASSIGNED',
      'specialist-99',
    );
    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        fromState: 'CREATED',
        toState: 'ASSIGNED',
        triggeredBy: 'SPECIALIST_ASSIGNED',
      }),
    );
  });

  it('throws SpecialistRequiredError when SPECIALIST_ASSIGNED is sent without specialistId', async () => {
    const { useCase } = makeUseCase();
    await expect(
      useCase.execute('ticket-1', 'SPECIALIST_ASSIGNED'),
    ).rejects.toThrow(SpecialistRequiredError);
  });

  it('uses existing specialistId from ticket when not provided in event', async () => {
    const { useCase, ticketRepo } = makeUseCase(
      makeTicket({ currentState: 'ACCEPTED', specialistId: 'specialist-42' }),
    );

    await useCase.execute('ticket-1', 'REPAIR_COMPLETED');

    expect(ticketRepo.updateState).toHaveBeenCalledWith(
      'ticket-1',
      'COMPLETED',
      'specialist-42',
    );
  });

  it('REPAIR_COMPLETED encadeia SURVEY_SENT e retorna CLOSED', async () => {
    const { useCase, ticketRepo, eventRepo, surveySent } = makeUseCase(
      makeTicket({ currentState: 'ACCEPTED', specialistId: 'specialist-42' }),
    );

    const result = await useCase.execute('ticket-1', 'REPAIR_COMPLETED');

    expect(result.to).toBe('CLOSED');
    expect(surveySent.execute).toHaveBeenCalledTimes(1);
    expect(ticketRepo.updateState).toHaveBeenCalledWith('ticket-1', 'CLOSED');
    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        fromState: 'COMPLETED',
        toState: 'CLOSED',
        triggeredBy: 'SURVEY_SENT',
      }),
    );
  });

  it('REPAIR_COMPLETED encadeia SURVEY_FAILED quando pesquisa falha e retorna NO_SURVEY sem erro', async () => {
    const { useCase, ticketRepo, eventRepo, surveySent, surveyFailed } =
      makeUseCase(
        makeTicket({ currentState: 'ACCEPTED', specialistId: 'specialist-42' }),
      );
    surveySent.execute = jest
      .fn()
      .mockRejectedValue(new Error('survey service down'));

    const result = await useCase.execute('ticket-1', 'REPAIR_COMPLETED');

    expect(result.to).toBe('NO_SURVEY');
    expect(surveyFailed.execute).toHaveBeenCalledTimes(1);
    expect(ticketRepo.updateState).toHaveBeenCalledWith(
      'ticket-1',
      'NO_SURVEY',
    );
    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        fromState: 'COMPLETED',
        toState: 'NO_SURVEY',
        triggeredBy: 'SURVEY_FAILED',
      }),
    );
  });

  it('transitions ACCEPTED → REASSIGN and persists reason', async () => {
    const { useCase, eventRepo } = makeUseCase(
      makeTicket({ currentState: 'ACCEPTED' }),
    );

    const result = await useCase.execute(
      'ticket-1',
      'REASSIGN_REQUESTED',
      undefined,
      'wrong specialist',
    );

    expect(result.to).toBe('REASSIGN');
    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: 'wrong specialist' }),
    );
  });

  it('throws on invalid transition and does not persist', async () => {
    const { useCase, ticketRepo, eventRepo } = makeUseCase();

    await expect(
      useCase.execute('ticket-1', 'REPAIR_COMPLETED'),
    ).rejects.toThrow();
    expect(ticketRepo.updateState).not.toHaveBeenCalled();
    expect(eventRepo.save).not.toHaveBeenCalled();
  });
});
