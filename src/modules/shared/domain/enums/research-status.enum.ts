/**
 * Global research status
 * Indicates whether a research job is currently running
 */
export enum ResearchStatus {
  IDLE = 'idle',
  RESEARCHING = 'researching',
}

/**
 * Validate if a string is a valid research status
 */
export function isValidResearchStatus(
  status: string,
): status is ResearchStatus {
  return Object.values(ResearchStatus).includes(status as ResearchStatus);
}
