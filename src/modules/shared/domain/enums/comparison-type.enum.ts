/**
 * Comparison type for promotion comparisons
 * Indicates how a discovered promotion relates to existing ones
 */
export enum ComparisonType {
  BETTER = 'better',
  ALTERNATIVE = 'alternative',
  NEW = 'new',
}

/**
 * Validate if a string is a valid comparison type
 */
export function isValidComparisonType(type: string): type is ComparisonType {
  return Object.values(ComparisonType).includes(type as ComparisonType);
}
