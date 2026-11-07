import { AssignmentEventPublisher, TICKET_MANAGEMENT_EXCHANGE } from '../assignment-event.publisher';

const makePublisher = () => {
  const amqp = { publish: jest.fn().mockResolvedValue(undefined) };
  const publisher = new AssignmentEventPublisher(amqp as any);
  return { publisher, amqp };
};

describe('AssignmentEventPublisher', () => {
  it('publishes ticket.assignment.requested to ticket.management exchange', async () => {
    const { publisher, amqp } = makePublisher();

    await publisher.publishAssignmentRequested('ticket-1');

    expect(amqp.publish).toHaveBeenCalledWith(
      TICKET_MANAGEMENT_EXCHANGE,
      'ticket.assignment.requested',
      { ticketId: 'ticket-1' },
    );
  });
});
