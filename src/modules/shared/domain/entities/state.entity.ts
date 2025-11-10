import { StateAbbreviation, STATE_NAMES } from '../enums/state.enum';

/**
 * State domain entity
 * Represents a US state with casino operations
 */
export class State {
  constructor(
    public readonly abbreviation: StateAbbreviation,
    public readonly name: string,
  ) {}

  /**
   * Create State entity from abbreviation
   */
  static fromAbbreviation(abbreviation: StateAbbreviation): State {
    return new State(abbreviation, STATE_NAMES[abbreviation]);
  }

  /**
   * Create all supported states
   */
  static getAllStates(): State[] {
    return Object.values(StateAbbreviation).map((abbr) =>
      State.fromAbbreviation(abbr),
    );
  }

  /**
   * Get display string
   */
  getDisplayString(): string {
    return `${this.name} (${this.abbreviation})`;
  }

  /**
   * Convert to plain object
   */
  toObject(): {
    abbreviation: StateAbbreviation;
    name: string;
  } {
    return {
      abbreviation: this.abbreviation,
      name: this.name,
    };
  }
}
