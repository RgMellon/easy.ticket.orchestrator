export interface IAssignmentEventPublisher {
  publishAssignmentRequested(ticketId: string): Promise<void>;
}

export const ASSIGNMENT_EVENT_PUBLISHER = Symbol('ASSIGNMENT_EVENT_PUBLISHER');
