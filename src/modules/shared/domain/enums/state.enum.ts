/**
 * State abbreviations for supported US states
 * Only four states are supported in the system
 */
export enum StateAbbreviation {
  NJ = 'NJ',
  MI = 'MI',
  PA = 'PA',
  WV = 'WV',
}

/**
 * Full state names mapping
 */
export const STATE_NAMES: Record<StateAbbreviation, string> = {
  [StateAbbreviation.NJ]: 'New Jersey',
  [StateAbbreviation.MI]: 'Michigan',
  [StateAbbreviation.PA]: 'Pennsylvania',
  [StateAbbreviation.WV]: 'West Virginia',
};

/**
 * Validate if a string is a valid state abbreviation
 */
export function isValidState(state: string): state is StateAbbreviation {
  return Object.values(StateAbbreviation).includes(state as StateAbbreviation);
}

/**
 * Get all supported states as an array
 */
export function getAllStates(): StateAbbreviation[] {
  return Object.values(StateAbbreviation);
}
