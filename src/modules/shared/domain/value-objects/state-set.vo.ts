import {
  StateAbbreviation,
  isValidState,
  getAllStates,
} from '../enums/state.enum';

/**
 * State Set Value Object
 * Validates and manages the four supported states
 */
export class StateSet {
  private readonly states: Set<StateAbbreviation>;

  constructor(states: StateAbbreviation[]) {
    this.states = new Set(states);
    this.validate();
  }

  /**
   * Create StateSet from string array
   * Throws error if any state is invalid
   */
  static fromStrings(states: string[]): StateSet {
    const validStates: StateAbbreviation[] = [];

    for (const state of states) {
      if (!isValidState(state)) {
        throw new Error(
          `Invalid state abbreviation: ${state}. Must be one of: NJ, MI, PA, WV`,
        );
      }
      validStates.push(state);
    }

    return new StateSet(validStates);
  }

  /**
   * Create StateSet with all supported states
   */
  static all(): StateSet {
    return new StateSet(getAllStates());
  }

  /**
   * Create StateSet with a single state
   */
  static single(state: StateAbbreviation): StateSet {
    return new StateSet([state]);
  }

  /**
   * Validate that at least one state is present
   */
  private validate(): void {
    if (this.states.size === 0) {
      throw new Error('StateSet must contain at least one state');
    }
  }

  /**
   * Check if a state is in the set
   */
  has(state: StateAbbreviation): boolean {
    return this.states.has(state);
  }

  /**
   * Get all states as array
   */
  toArray(): StateAbbreviation[] {
    return Array.from(this.states);
  }

  /**
   * Get count of states
   */
  count(): number {
    return this.states.size;
  }

  /**
   * Check if this set contains all supported states
   */
  isAllStates(): boolean {
    return this.states.size === 4;
  }

  /**
   * Get display string
   */
  toString(): string {
    return this.toArray().join(', ');
  }

  /**
   * Create a new StateSet with an additional state
   */
  add(state: StateAbbreviation): StateSet {
    const newStates = [...this.toArray(), state];
    return new StateSet(newStates);
  }

  /**
   * Create a new StateSet without a state
   */
  remove(state: StateAbbreviation): StateSet {
    const newStates = this.toArray().filter((s) => s !== state);

    if (newStates.length === 0) {
      throw new Error('Cannot remove last state from StateSet');
    }

    return new StateSet(newStates);
  }

  /**
   * Check equality with another StateSet
   */
  equals(other: StateSet): boolean {
    if (this.states.size !== other.states.size) {
      return false;
    }

    for (const state of this.states) {
      if (!other.has(state)) {
        return false;
      }
    }

    return true;
  }
}
