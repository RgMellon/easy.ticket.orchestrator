export class InvalidTransitionError extends Error {
  constructor(
    public readonly event: string,
    public readonly state: string,
  ) {
    super(`Cannot fire '${event}' from state '${state}'`);
    this.name = 'InvalidTransitionError';
  }
}

export class SpecialistRequiredError extends Error {
  constructor() {
    super('specialistId is required to assign a specialist to a ticket');
    this.name = 'SpecialistRequiredError';
  }
}

export class StateMachineExecutionError extends Error {
  constructor(
    public readonly event: string,
    cause: Error,
  ) {
    super(`State machine failed on '${event}': ${cause.message}`);
    this.name = 'StateMachineExecutionError';
    this.cause = cause;
  }
}
