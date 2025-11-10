import { StateAbbreviation } from '../enums/state.enum';

export class InvalidStateException extends Error {
  constructor(providedState: string) {
    const validStates = Object.values(StateAbbreviation).join(', ');
    super(`Invalid state: ${providedState}. Valid states are: ${validStates}`);
    this.name = 'InvalidStateException';
    Error.captureStackTrace(this, this.constructor);
  }
}
