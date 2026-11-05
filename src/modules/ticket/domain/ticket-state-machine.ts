import { Logger } from '@nestjs/common';
import {
  TicketSagaContext,
  TicketSagaEvent,
  TicketSagaState,
} from './ticket-saga.types';

type ActionHandler = (context: TicketSagaContext) => Promise<void>;

interface TransitionConfig {
  target: TicketSagaState;
  action?: ActionHandler;
}

type TransitionTable = Record<
  TicketSagaState,
  Partial<Record<TicketSagaEvent, TransitionConfig>>
>;

export class TicketStateMachine {
  private readonly logger = new Logger(TicketStateMachine.name);
  private currentState: TicketSagaState;
  private readonly transitions: TransitionTable;

  constructor(
    initialState: TicketSagaState,
    private readonly context: TicketSagaContext,
    actions: {
      onSpecialistAssigned: ActionHandler;
      onTicketRouted: ActionHandler;
      onRepairCompleted: ActionHandler;
      onReassignRequested: ActionHandler;
      onSurveySent: ActionHandler;
      onSurveyFailed: ActionHandler;
    },
  ) {
    this.currentState = initialState;

    this.transitions = {
      CREATED: {
        SPECIALIST_ASSIGNED: {
          target: 'ASSIGNED',
          action: actions.onSpecialistAssigned,
        },
      },
      ASSIGNED: {
        TICKET_ROUTED: {
          target: 'ACCEPTED',
          action: actions.onTicketRouted,
        },
      },
      ACCEPTED: {
        REPAIR_COMPLETED: {
          target: 'COMPLETED',
          action: actions.onRepairCompleted,
        },
        REASSIGN_REQUESTED: {
          target: 'REASSIGN',
          action: actions.onReassignRequested,
        },
      },
      REASSIGN: {
        SPECIALIST_ASSIGNED: {
          target: 'ASSIGNED',
          action: actions.onSpecialistAssigned,
        },
      },
      COMPLETED: {
        SURVEY_SENT: {
          target: 'CLOSED',
          action: actions.onSurveySent,
        },
        SURVEY_FAILED: {
          target: 'NO_SURVEY',
          action: actions.onSurveyFailed,
        },
      },
      NO_SURVEY: {
        SURVEY_SENT: {
          target: 'CLOSED',
          action: actions.onSurveySent,
        },
      },
      CLOSED: {},
    };
  }

  getCurrentState(): TicketSagaState {
    return this.currentState;
  }

  async send(
    event: TicketSagaEvent,
    reason?: string,
  ): Promise<TicketSagaState> {
    const transition = this.transitions[this.currentState][event];

    if (!transition) {
      this.logger.warn({
        ticketId: this.context.ticketId,
        state: this.currentState,
        event,
        msg: 'invalid transition',
      });
      throw new Error(
        `Invalid transition: cannot fire '${event}' from state '${this.currentState}'`,
      );
    }

    if (reason) this.context.errorMessage = reason;

    const previousState = this.currentState;
    this.currentState = transition.target;

    try {
      if (transition.action) await transition.action(this.context);

      this.logger.log({
        ticketId: this.context.ticketId,
        from: previousState,
        to: this.currentState,
        event,
        msg: 'state transition',
      });

      return this.currentState;
    } catch (error) {
      this.currentState = previousState;
      this.logger.error({
        ticketId: this.context.ticketId,
        state: previousState,
        event,
        error: (error as Error).message,
        msg: 'transition action failed, rolling back',
      });
      throw new Error(
        `State machine execution failed on '${event}': ${(error as Error).message}`,
      );
    }
  }
}
