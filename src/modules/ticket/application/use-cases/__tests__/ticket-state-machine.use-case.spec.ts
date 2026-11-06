import { NotFoundException } from '@nestjs/common';
import { TicketStateMachineUseCase } from '../ticket-state-machine.use-case';
import { TicketEntity } from '../../../domain/ticket.repository';
import { TicketActions } from '../../../domain/ticket.actions';
import { SpecialistRequiredError } from '../../../../../common/errors/domain.errors';

const makeTicket = (override?: Partial<TicketEntity>): TicketEntity => ({
  id: 'ticket-1',
  clientId: 'client-1',
  specialistId: undefined,
  currentState: 'CREATED',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...override,
});

const makeActions = (): TicketActions => ({
  assignSpecialist: { execute: jest.fn().mockResolvedValue(undefined) },
  routeTicket: { execute: jest.fn().mockResolvedValue(undefined) },
  repairCompleted: { execute: jest.fn().mockResolvedValue(undefined) },
  reassignRequested: { execute: jest.fn().mockResolvedValue(undefined) },
  surveySent: { execute: jest.fn().mockResolvedValue(undefined) },
  surveyFailed: { execute: jest.fn().mockResolvedValue(undefined) },
});

const makeUseCase = (ticket: TicketEntity | null = makeTicket()) => {
  const ticketRepo = {
    findById: jest.fn().mockResolvedValue(ticket),
    updateState: jest.fn().mockResolvedValue(undefined),
    create: jest.fn(),
  };
  const eventRepo = { save: jest.fn().mockResolvedValue(undefined) };
  const actions = makeActions();
  const useCase = new TicketStateMachineUseCase(
    ticketRepo as any,
    eventRepo as any,
    actions,
  );
  return { useCase, ticketRepo, eventRepo, actions };
};

describe('TicketStateMachineUseCase', () => {
  it('throws NotFoundException when ticket does not exist', async () => {
    const { useCase } = makeUseCase(null);
    await expect(useCase.execute('ticket-1', 'SPECIALIST_ASSIGNED')).rejects.toThrow(NotFoundException);
  });

  it('transitions CREATED → ASSIGNED and persists specialistId', async () => {
    const { useCase, ticketRepo, eventRepo, actions } = makeUseCase();

    const result = await useCase.execute('ticket-1', 'SPECIALIST_ASSIGNED', 'specialist-99');

    expect(result).toEqual({ ticketId: 'ticket-1', from: 'CREATED', to: 'ASSIGNED' });
    expect(actions.assignSpecialist.execute).toHaveBeenCalledTimes(1);
    expect(ticketRepo.updateState).toHaveBeenCalledWith('ticket-1', 'ASSIGNED', 'specialist-99');
    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ fromState: 'CREATED', toState: 'ASSIGNED', triggeredBy: 'SPECIALIST_ASSIGNED' }),
    );
  });

  it('throws SpecialistRequiredError when SPECIALIST_ASSIGNED is sent without specialistId', async () => {
    const { useCase } = makeUseCase();
    await expect(useCase.execute('ticket-1', 'SPECIALIST_ASSIGNED')).rejects.toThrow(SpecialistRequiredError);
  });

  it('uses existing specialistId from ticket when not provided in event', async () => {
    const { useCase, ticketRepo } = makeUseCase(
      makeTicket({ currentState: 'ACCEPTED', specialistId: 'specialist-42' }),
    );

    await useCase.execute('ticket-1', 'REPAIR_COMPLETED');

    expect(ticketRepo.updateState).toHaveBeenCalledWith('ticket-1', 'COMPLETED', 'specialist-42');
  });

  it('transitions ACCEPTED → REASSIGN and persists reason', async () => {
    const { useCase, eventRepo } = makeUseCase(makeTicket({ currentState: 'ACCEPTED' }));

    const result = await useCase.execute('ticket-1', 'REASSIGN_REQUESTED', undefined, 'wrong specialist');

    expect(result.to).toBe('REASSIGN');
    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: 'wrong specialist' }),
    );
  });

  it('throws on invalid transition and does not persist', async () => {
    const { useCase, ticketRepo, eventRepo } = makeUseCase();

    await expect(useCase.execute('ticket-1', 'REPAIR_COMPLETED')).rejects.toThrow();
    expect(ticketRepo.updateState).not.toHaveBeenCalled();
    expect(eventRepo.save).not.toHaveBeenCalled();
  });
});
