/**
 * Status of a promotion comparison
 * Tracks the lifecycle of user review and action
 */
export enum ComparisonStatus {
  PENDING = 'pending',
  UPDATED = 'updated',
  REVIEWED = 'reviewed',
  IGNORED = 'ignored',
}

/**
 * Validate if a string is a valid comparison status
 */
export function isValidComparisonStatus(
  status: string,
): status is ComparisonStatus {
  return Object.values(ComparisonStatus).includes(status as ComparisonStatus);
}

/**
 * Get allowed status transitions
 * Defines which status changes are valid
 */
export function getAllowedStatusTransitions(
  currentStatus: ComparisonStatus,
): ComparisonStatus[] {
  switch (currentStatus) {
    case ComparisonStatus.PENDING:
      // From pending, can move to any other status
      return [
        ComparisonStatus.UPDATED,
        ComparisonStatus.REVIEWED,
        ComparisonStatus.IGNORED,
      ];
    case ComparisonStatus.UPDATED:
    case ComparisonStatus.REVIEWED:
    case ComparisonStatus.IGNORED:
      // From final states, can only move to other final states
      return [
        ComparisonStatus.UPDATED,
        ComparisonStatus.REVIEWED,
        ComparisonStatus.IGNORED,
      ];
    default:
      return [];
  }
}
