import { TicketStateMachine } from '../ticket-state-machine';
import { TicketSagaContext } from '../ticket-saga.types';

const noop = jest.fn().mockResolvedValue(undefined);

const makeActions = () => ({
  onSpecialistAssigned: jest.fn().mockResolvedValue(undefined),
  onTicketRouted: jest.fn().mockResolvedValue(undefined),
  onRepairCompleted: jest.fn().mockResolvedValue(undefined),
  onReassignRequested: jest.fn().mockResolvedValue(undefined),
  onSurveySent: jest.fn().mockResolvedValue(undefined),
  onSurveyFailed: jest.fn().mockResolvedValue(undefined),
});

const baseContext = (): TicketSagaContext => ({
  ticketId: 'ticket-1',
  clientId: 'client-1',
});

describe('TicketStateMachine', () => {
  describe('happy path: CREATED → CLOSED', () => {
    it('CREATED → ASSIGNED via SPECIALIST_ASSIGNED', async () => {
      const actions = makeActions();
      const machine = new TicketStateMachine('CREATED', baseContext(), actions);

      const to = await machine.send('SPECIALIST_ASSIGNED');

      expect(to).toBe('ASSIGNED');
      expect(actions.onSpecialistAssigned).toHaveBeenCalledTimes(1);
    });

    it('ASSIGNED → ACCEPTED via TICKET_ROUTED', async () => {
      const actions = makeActions();
      const machine = new TicketStateMachine('ASSIGNED', baseContext(), actions);

      const to = await machine.send('TICKET_ROUTED');

      expect(to).toBe('ACCEPTED');
      expect(actions.onTicketRouted).toHaveBeenCalledTimes(1);
    });

    it('ACCEPTED → COMPLETED via REPAIR_COMPLETED', async () => {
      const actions = makeActions();
      const machine = new TicketStateMachine('ACCEPTED', baseContext(), actions);

      const to = await machine.send('REPAIR_COMPLETED');

      expect(to).toBe('COMPLETED');
    });

    it('COMPLETED → CLOSED via SURVEY_SENT', async () => {
      const actions = makeActions();
      const machine = new TicketStateMachine('COMPLETED', baseContext(), actions);

      const to = await machine.send('SURVEY_SENT');

      expect(to).toBe('CLOSED');
    });
  });

  describe('reassign path: ACCEPTED → REASSIGN → ASSIGNED', () => {
    it('ACCEPTED → REASSIGN via REASSIGN_REQUESTED', async () => {
      const actions = makeActions();
      const machine = new TicketStateMachine('ACCEPTED', baseContext(), actions);

      const to = await machine.send('REASSIGN_REQUESTED', 'specialist unavailable');

      expect(to).toBe('REASSIGN');
      expect(actions.onReassignRequested).toHaveBeenCalledTimes(1);
    });

    it('REASSIGN → ASSIGNED via SPECIALIST_ASSIGNED', async () => {
      const actions = makeActions();
      const machine = new TicketStateMachine('REASSIGN', baseContext(), actions);

      const to = await machine.send('SPECIALIST_ASSIGNED');

      expect(to).toBe('ASSIGNED');
      expect(actions.onSpecialistAssigned).toHaveBeenCalledTimes(1);
    });
  });

  describe('survey failure path: COMPLETED → NO_SURVEY → CLOSED', () => {
    it('COMPLETED → NO_SURVEY via SURVEY_FAILED', async () => {
      const actions = makeActions();
      const machine = new TicketStateMachine('COMPLETED', baseContext(), actions);

      const to = await machine.send('SURVEY_FAILED', 'survey service unavailable');

      expect(to).toBe('NO_SURVEY');
      expect(actions.onSurveyFailed).toHaveBeenCalledTimes(1);
    });

    it('NO_SURVEY → CLOSED via SURVEY_SENT (retry)', async () => {
      const actions = makeActions();
      const machine = new TicketStateMachine('NO_SURVEY', baseContext(), actions);

      const to = await machine.send('SURVEY_SENT');

      expect(to).toBe('CLOSED');
      expect(actions.onSurveySent).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalid transitions', () => {
    const invalidCases: Array<{ state: any; event: any }> = [
      { state: 'CREATED', event: 'TICKET_ROUTED' },
      { state: 'CREATED', event: 'REPAIR_COMPLETED' },
      { state: 'ASSIGNED', event: 'SPECIALIST_ASSIGNED' },
      { state: 'ASSIGNED', event: 'REPAIR_COMPLETED' },
      { state: 'ACCEPTED', event: 'SPECIALIST_ASSIGNED' },
      { state: 'ACCEPTED', event: 'TICKET_ROUTED' },
      { state: 'COMPLETED', event: 'REPAIR_COMPLETED' },
      { state: 'CLOSED', event: 'SURVEY_SENT' },
      { state: 'NO_SURVEY', event: 'SURVEY_FAILED' },
    ];

    it.each(invalidCases)(
      'throws on $event from $state',
      async ({ state, event }) => {
        const machine = new TicketStateMachine(state, baseContext(), makeActions());

        await expect(machine.send(event)).rejects.toThrow(
          `Cannot fire '${event}' from state '${state}'`,
        );
      },
    );
  });

  describe('action failure rolls back state', () => {
    it('keeps previous state when action throws', async () => {
      const actions = makeActions();
      actions.onSpecialistAssigned.mockRejectedValueOnce(new Error('db error'));

      const machine = new TicketStateMachine('CREATED', baseContext(), actions);

      await expect(machine.send('SPECIALIST_ASSIGNED')).rejects.toThrow(
        "State machine failed on 'SPECIALIST_ASSIGNED': db error",
      );

      expect(machine.getCurrentState()).toBe('CREATED');
    });
  });

  describe('reason propagation', () => {
    it('sets errorMessage on context when reason is provided', async () => {
      const ctx = baseContext();
      const actions = makeActions();
      const machine = new TicketStateMachine('ACCEPTED', ctx, actions);

      await machine.send('REASSIGN_REQUESTED', 'wrong specialist');

      expect(ctx.errorMessage).toBe('wrong specialist');
    });
  });
});
