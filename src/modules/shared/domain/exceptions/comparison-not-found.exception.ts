export class ComparisonNotFoundException extends Error {
  constructor(comparisonId: string) {
    super(`Promotion comparison not found with id: ${comparisonId}`);
    this.name = 'ComparisonNotFoundException';
    Error.captureStackTrace(this, this.constructor);
  }
}
