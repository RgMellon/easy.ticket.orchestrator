import { AssignmentEventListener } from '../assignment-event.listener';

const makeListener = () => {
  const stateMachine = {
    execute: jest.fn().mockResolvedValue({
      ticketId: 'ticket-1',
      from: 'CREATED',
      to: 'ASSIGNED',
    }),
  };
  const listener = new AssignmentEventListener(stateMachine as any);
  return { listener, stateMachine };
};

describe('AssignmentEventListener', () => {
  it('calls stateMachine with SPECIALIST_ASSIGNED on ticket.assignment.completed', async () => {
    const { listener, stateMachine } = makeListener();

    await listener.handleAssignmentCompleted({
      ticketId: 'ticket-1',
      specialistId: 'specialist-99',
    });

    expect(stateMachine.execute).toHaveBeenCalledWith(
      'ticket-1',
      'SPECIALIST_ASSIGNED',
      'specialist-99',
    );
  });

  it('propagates error if stateMachine throws', async () => {
    const { listener, stateMachine } = makeListener();
    stateMachine.execute.mockRejectedValue(new Error('transition failed'));

    await expect(
      listener.handleAssignmentCompleted({
        ticketId: 'ticket-1',
        specialistId: 'specialist-99',
      }),
    ).rejects.toThrow('transition failed');
  });
});
