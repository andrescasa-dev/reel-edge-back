export class DatabaseException extends Error {
  constructor(operation: string, originalError?: Error) {
    const message = originalError
      ? `Database operation failed (${operation}): ${originalError.message}`
      : `Database operation failed: ${operation}`;
    super(message);
    this.name = 'DatabaseException';
    Error.captureStackTrace(this, this.constructor);
  }
}
